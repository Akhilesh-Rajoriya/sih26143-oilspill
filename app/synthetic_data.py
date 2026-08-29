import numpy as np
import matplotlib.pyplot as plt
from app.config import RegionOfInterest


def generate_sar_scene(roi: RegionOfInterest, seed: int = 42, grid_size: int = 200):
    rng = np.random.default_rng(seed)
    background = -13.0 + rng.normal(0, 1.4, size=(grid_size, grid_size))
    return background.astype(np.float32)

if __name__ == "__main__":
    roi = RegionOfInterest()
    scene = generate_sar_scene(roi)
    print("shape:", scene.shape, "min:", scene.min(), "max:", scene.max())
    plt.imshow(scene, cmap="gray")
    plt.title("Stage 1: background only")
    plt.colorbar(label="dB")
    plt.savefig("stage1_background.png")
    print("saved stage1_background.png")


