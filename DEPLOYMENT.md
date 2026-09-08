# SIH-26143 Live Cloud Deployment Guide
# SIH-26143 Cloud Deployment Guide (100% Free on Render.com)

Deploy the **SIH-26143 Maritime Oil Spill Surveillance System** to the live cloud for **100% Free** with a permanent public HTTPS website URL for the 12 September hackathon.
Deploy the **SIH-26143 Maritime Oil Spill Surveillance System** to a live public HTTPS website URL for **100% Free** using **Render.com**.

On 12 September, you and your team will simply open your live website link (e.g., `https://sih26143-oilspill.onrender.com`) on any browser, laptop, or phone. Zero local terminal and zero GPU required.

---

## 🌟 Method 1: 100% Free Cloud Deployment on Hugging Face Spaces (Recommended)
## 🚀 Step-by-Step: 100% Free Cloud Deployment on Render.com

Hugging Face Spaces provides **Free 2 vCPUs and 16 GB of RAM**, which is plenty of power to run our PyTorch U-Net model and ocean physics engine.
### Step 1: Push your Code to GitHub

### Step 1: Create a Free Hugging Face Space
1. Sign up or log in at [huggingface.co](https://huggingface.co).
2. Go to [huggingface.co/new-space](https://huggingface.co/new-space).
3. Set **Space Name**: `sih26143-oilspill`.
4. Set **License**: `MIT` or `Open Source`.
5. Select **Space SDK**: **Docker** ➔ choose **Blank**.
6. Set **Space Hardware**: **CPU basic · 2 vCPU · 16 GB · Free**.
7. Click **Create Space**.
If you haven't already pushed your project to GitHub:
1. Open PowerShell in `D:\sih26143`:
   ```powershell
   cd D:\sih26143
   git add .
   git commit -m "Add full-stack web dashboard and cloud deployment files"
   ```
2. Create a new repository on [github.com/new](https://github.com/new) (name it `sih26143-oilspill`).
3. Push your code:
   ```powershell
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/sih26143-oilspill.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Push this Repository to your Space
In your local terminal (inside `d:\sih26143`):
```bash
# Add your Space as a remote
git remote add space https://huggingface.co/spaces/<YOUR_HF_USERNAME>/sih26143-oilspill
---

# Push code to build the container
git add .
git commit -m "Deploy SIH26143 unified web dashboard"
git push space main
```
### Step 2: Create a Free Account on Render.com

### Step 3: Done!
* Hugging Face will build the Docker container in ~3 minutes.
* Your live website will be accessible globally at:
  **`https://<YOUR_HF_USERNAME>-sih26143-oilspill.hf.space`**
* You can open this link on your phone, laptop, or projector. Zero terminal and zero local GPU needed on 12 September!
1. Go to [render.com](https://render.com).
2. Click **"Get Started"** or **"Sign In"**.
3. Select **"Continue with GitHub"** (this automatically links your repositories).

---

## 🚀 Method 2: Free Hosting on Render.com
### Step 3: Deploy the Web Service (Free Tier)

1. Push your repository to **GitHub**.
2. Log into [render.com](https://render.com).
3. Click **New +** ➔ **Web Service**.
4. Connect your GitHub repository.
5. Select **Docker** environment.
6. Render will automatically detect the `Dockerfile` and deploy it on a free URL:
   **`https://sih26143-oilspill.onrender.com`**
1. On your Render Dashboard, click the **"New +"** button in the top right.
2. Select **"Web Service"**.
3. Under **"Connect a repository"**, select your `sih26143-oilspill` repository.
4. Fill in the simple form:
   * **Name:** `sih26143-oilspill` (or any name you prefer).
   * **Region:** Leave default (e.g., *Oregon (US West)* or *Frankfurt*).
   * **Branch:** `main`.
   * **Runtime:** Select **Docker** (Render will automatically detect the `Dockerfile`).
   * **Instance Type:** Select **Free ($0/month)**.
5. Click **"Deploy Web Service"** at the bottom.

---

## 💻 Method 3: Local 1-Click Launch (Backup)
### Step 4: Your Website is Live!

To run locally on your laptop without cloud:
1. Open PowerShell and make sure you are in `D:\sih26143`:
   ```powershell
   cd D:\sih26143
   .\start_demo.bat
   ```
2. Navigate to:
   * **Web Dashboard:** `http://localhost:5173`
   * **API Swagger Docs:** `http://localhost:8000/docs`
* Render will build your container in ~3 to 4 minutes.
* You will see a live URL at the top of your Render dashboard:
  **`https://sih26143-oilspill.onrender.com`**
* Click that link — your full interactive Tactical GIS Map, Scrubber, and Vessel Attribution cards will load immediately!

---

## 💻 Backup: How to Run Locally on Your Laptop in 1 Second

If you ever want to run it on your laptop without any cloud or internet:

1. Open **Windows File Explorer** (your normal yellow folder icon).
2. Go to **`D:\sih26143`**.
3. **Double-click on `start_demo.bat`**.
4. Both servers will launch automatically in separate terminal windows:
   * **Web Dashboard:** Open `http://localhost:5173` in your browser.
   * **Backend Swagger API:** `http://localhost:8000/docs`
