# SIH-26143: Satellite Oil Spill Detection & AIS Attribution System

**Problem Statement 143** — NTRO | Software, Space Technology

Automated maritime surveillance pipeline connecting three critical signals:
1. **Satellite SAR Oil Spill Detection:** Deep-learning U-Net segmentation on Sentinel-1 radar backscatter.
2. **Lagrangian Drift Backtracking:** High-speed vectorized reverse hindcasting with ERA5 wind and CMEMS ocean surface currents to pinpoint the spill origin window.
3. **AIS Vessel Attribution Engine:** Multi-factor Bayesian scoring detecting transponder blackouts and illegal bilge discharge deceleration profiles.

---

## 🚀 100% Free Cloud Deployment on Render.com

This repository is containerized and ready for **1-click free hosting on Render.com**:

1. Push this repository to your **GitHub**.
2. Sign in to [render.com](https://render.com) using your GitHub account.
3. Click **New +** ➔ **Web Service**.
4. Select this repository and pick the **Free ($0/month)** plan.
5. Render automatically builds the `Dockerfile` and deploys your website on a permanent public URL:
   `https://<your-app-name>.onrender.com`

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for full step-by-step instructions.

---

## 💻 Local Quickstart (1-Click)

To run locally on your laptop:
1. Double-click [`start_demo.bat`](./start_demo.bat) in `D:\sih26143`.
2. Open `http://localhost:5173` in your browser.