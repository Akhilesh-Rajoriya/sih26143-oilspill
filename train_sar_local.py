import os
import numpy as np
import rasterio
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from sklearn.model_selection import train_test_split
import warnings
warnings.filterwarnings("ignore")

# ============ Paths ============
OIL_DIR = "D:/SIH_OilSpill/training_data/raw/images/Oil"
LOOKALIKE_DIR = "D:/SIH_OilSpill/training_data/raw/images/Lookalike"
NO_OIL_DIR = "D:/SIH_OilSpill/training_data/raw/images/No_oil"
OIL_MASK_DIR = "D:/SIH_OilSpill/training_data/raw/masks_extracted/Oil/Mask_oil"
MODEL_DIR = "D:/sih26143/models"
os.makedirs(MODEL_DIR, exist_ok=True)

# ============ Model (same architecture as detector.py) ============
class DoubleConv(nn.Module):
    def __init__(self, in_channels, out_channels):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, 3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, 3, padding=1),
            nn.ReLU(inplace=True)
        )
    def forward(self, x):
        return self.block(x)

class UNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.enc1 = DoubleConv(2, 32)
        self.enc2 = DoubleConv(32, 64)
        self.enc3 = DoubleConv(64, 128)
        self.pool = nn.MaxPool2d(2)
        self.bottleneck = DoubleConv(128, 256)
        self.up3 = nn.ConvTranspose2d(256, 128, 2, stride=2)
        self.dec3 = DoubleConv(256, 128)
        self.up2 = nn.ConvTranspose2d(128, 64, 2, stride=2)
        self.dec2 = DoubleConv(128, 64)
        self.up1 = nn.ConvTranspose2d(64, 32, 2, stride=2)
        self.dec1 = DoubleConv(64, 32)
        self.final = nn.Conv2d(32, 1, 1)

    def forward(self, x):
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))
        b = self.bottleneck(self.pool(e3))
        d3 = self.up3(b); d3 = torch.cat([d3, e3], dim=1); d3 = self.dec3(d3)
        d2 = self.up2(d3); d2 = torch.cat([d2, e2], dim=1); d2 = self.dec2(d2)
        d1 = self.up1(d2); d1 = torch.cat([d1, e1], dim=1); d1 = self.dec1(d1)
        return self.final(d1)

# ============ Loss ============
class DiceLoss(nn.Module):
    def __init__(self, smooth=1.0):
        super().__init__()
        self.smooth = smooth
    def forward(self, logits, targets):
        probs = torch.sigmoid(logits)
        probs, targets = probs.view(-1), targets.view(-1)
        intersection = (probs * targets).sum()
        dice = (2 * intersection + self.smooth) / (probs.sum() + targets.sum() + self.smooth)
        return 1 - dice

bce_loss = nn.BCEWithLogitsLoss()
dice_loss = DiceLoss()
def combined_loss(pred, target):
    return 0.5 * bce_loss(pred, target) + 0.5 * dice_loss(pred, target)

# ============ Dataset ============
class CombinedOilSpillDataset(Dataset):
    def __init__(self, oil_files, lookalike_files, nooil_files,
                 oil_dir, lookalike_dir, nooil_dir, oil_mask_dir, size=512):
        self.size = size
        self.records = []
        for f in oil_files:
            self.records.append(("oil", f, oil_dir))
        for f in lookalike_files:
            self.records.append(("negative", f, lookalike_dir))
        for f in nooil_files:
            self.records.append(("negative", f, nooil_dir))
        self.oil_mask_dir = oil_mask_dir

    def __len__(self):
        return len(self.records)

    def __getitem__(self, idx):
        category, filename, image_dir = self.records[idx]
        image_path = os.path.join(image_dir, filename)

        with rasterio.open(image_path) as src:
            image = src.read().astype(np.float32)

        for c in range(image.shape[0]):
            mean = image[c].mean()
            std = image[c].std()
            image[c] = (image[c] - mean) / (std + 1e-8)

        if category == "oil":
            mask_path = os.path.join(self.oil_mask_dir, filename)
            with rasterio.open(mask_path) as src:
                mask = src.read(1).astype(np.float32)
        else:
            mask = np.zeros((2048, 2048), dtype=np.float32)

        image = torch.from_numpy(image)
        mask = torch.from_numpy(mask).unsqueeze(0)

        image = F.interpolate(image.unsqueeze(0), size=(self.size, self.size),
                               mode="bilinear", align_corners=False).squeeze(0)
        mask = F.interpolate(mask.unsqueeze(0), size=(self.size, self.size),
                              mode="nearest").squeeze(0)
        mask = (mask > 0.5).float()

        return image, mask

# ============ Evaluation ============
def evaluate(model, loader, device):
    model.eval()
    dice_scores, iou_scores, precision_scores, recall_scores = [], [], [], []
    with torch.no_grad():
        for images, masks in loader:
            images, masks = images.to(device), masks.to(device)
            outputs = model(images)
            probs = torch.sigmoid(outputs)
            preds = (probs > 0.5).float()

            preds_flat = preds.view(-1)
            masks_flat = masks.view(-1)
            tp = (preds_flat * masks_flat).sum().item()
            fp = (preds_flat * (1 - masks_flat)).sum().item()
            fn = ((1 - preds_flat) * masks_flat).sum().item()

            dice_scores.append((2 * tp) / (2 * tp + fp + fn + 1e-8))
            iou_scores.append(tp / (tp + fp + fn + 1e-8))
            precision_scores.append(tp / (tp + fp + 1e-8))
            recall_scores.append(tp / (tp + fn + 1e-8))

    return {
        "Dice": np.mean(dice_scores),
        "IoU": np.mean(iou_scores),
        "Precision": np.mean(precision_scores),
        "Recall": np.mean(recall_scores),
    }

# ============ Main ============
if __name__ == "__main__":
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")

    oil_files_all = sorted([f for f in os.listdir(OIL_DIR) if f.endswith(".tif")])
    mask_files_available = set(os.listdir(OIL_MASK_DIR))
    oil_files = [f for f in oil_files_all if f in mask_files_available]
    skipped = len(oil_files_all) - len(oil_files)
    if skipped > 0:
        print(f"WARNING: Skipped {skipped} oil images with no matching mask file")

    lookalike_files = sorted([f for f in os.listdir(LOOKALIKE_DIR) if f.endswith(".tif")])
    no_oil_files = sorted([f for f in os.listdir(NO_OIL_DIR) if f.endswith(".tif")])
    print(f"Oil (matched): {len(oil_files)}, Look-alike: {len(lookalike_files)}, No-Oil: {len(no_oil_files)}")

    oil_train, oil_val = train_test_split(oil_files, test_size=0.15, random_state=42)
    look_train, look_val = train_test_split(lookalike_files, test_size=0.15, random_state=42)
    nooil_train, nooil_val = train_test_split(no_oil_files, test_size=0.15, random_state=42)

    train_dataset = CombinedOilSpillDataset(oil_train, look_train, nooil_train,
                                             OIL_DIR, LOOKALIKE_DIR, NO_OIL_DIR, OIL_MASK_DIR)
    val_dataset = CombinedOilSpillDataset(oil_val, look_val, nooil_val,
                                           OIL_DIR, LOOKALIKE_DIR, NO_OIL_DIR, OIL_MASK_DIR)

    train_loader = DataLoader(train_dataset, batch_size=4, shuffle=True, num_workers=4)
    val_loader = DataLoader(val_dataset, batch_size=4, shuffle=False, num_workers=4)
    print(f"Training samples: {len(train_dataset)}, Validation samples: {len(val_dataset)}")

    model = UNet().to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)

    EPOCHS = 10
    for epoch in range(EPOCHS):
        model.train()
        train_loss = 0.0
        for images, masks in train_loader:
            images, masks = images.to(device), masks.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = combined_loss(outputs, masks)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
        train_loss /= len(train_loader)

        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for images, masks in val_loader:
                images, masks = images.to(device), masks.to(device)
                outputs = model(images)
                loss = combined_loss(outputs, masks)
                val_loss += loss.item()
        val_loss /= len(val_loader)

        print(f"Epoch {epoch+1}/{EPOCHS} | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f}")

        checkpoint_path = os.path.join(MODEL_DIR, f"unet_epoch_{epoch+1:02d}.pth")
        torch.save(model.state_dict(), checkpoint_path)
        print(f"  Saved: {checkpoint_path}")

    final_path = os.path.join(MODEL_DIR, "unet_baseline_local.pth")
    torch.save(model.state_dict(), final_path)
    print(f"\nFinal model saved: {final_path}")

    print("\n" + "="*50)
    print("VERIFYING SAVED MODEL (fresh reload from disk)")
    print("="*50)
    verify_model = UNet().to(device)
    verify_model.load_state_dict(torch.load(final_path, map_location=device))
    verify_model.eval()

    metrics = evaluate(verify_model, val_loader, device)
    print(f"Dice Score : {metrics['Dice']:.4f}")
    print(f"IoU Score  : {metrics['IoU']:.4f}")
    print(f"Precision  : {metrics['Precision']:.4f}")
    print(f"Recall     : {metrics['Recall']:.4f}")

    if metrics['IoU'] < 0.05:
        print("\n⚠️  WARNING: Metrics suspiciously low - model may not have trained correctly.")
    else:
        print("\n✅ Model verified working - safe to use for integration.")