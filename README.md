# Intelligent Traffic Management & Signal Optimization System

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-000000.svg)](https://docs.ultralytics.com/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB.svg)](https://reactjs.org/)
[![Arduino](https://img.shields.io/badge/Arduino-Hardware-00979D.svg)](https://www.arduino.cc/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An end-to-end computer vision and embedded systems project that replaces static, timed traffic light signals with dynamic, density-driven control logic. Developed as a Bachelor's Graduation Thesis at Niğde Ömer Halisdemir University, Department of Computer Engineering.

---

## 📌 Problem & Executive Summary

Conventional traffic lights operate on fixed time intervals regardless of actual road conditions, leading to unnecessary delays, fuel waste, and increased carbon emissions during peak hours. 

This project implements an intelligent, closed-loop simulation that:
1. Captures live traffic feeds from intersection cameras.
2. Performs real-time vehicle identification and density calculation using **YOLOv8**.
3. Dynamically calculates optimal green light durations via an adaptive backend algorithm.
4. Transmits physical signal control commands to **Arduino** hardware over serial communication.
5. Provides a live telemetry dashboard built in **React.js** for real-time monitoring and analytics.

---


## 🏗️ System Architecture & Workflow


```

┌──────────────────┐     ┌───────────────────────┐     ┌────────────────────────┐
│  Live Video Feed │ ──> │ YOLOv8 Object Detection│ ──> │ Density Calculator     │
└──────────────────┘     └───────────────────────┘     └────────────────────────┘
│
▼
┌──────────────────┐     ┌───────────────────────┐     ┌────────────────────────┐
│  React Dashboard │ <── │  Backend Server / API │ ──> │ Serial / Arduino Signal│
│  (Live Metrics)  │     │  (Dynamic Timing Logic)│    │ (Traffic Light LEDs)   │
└──────────────────┘     └───────────────────────┘     └────────────────────────┘

```

---

## ✨ Key Features

* **Real-Time Object Detection:** Fine-tuned YOLOv8 model capable of accurately classifying and counting cars, buses, trucks, and motorcycles under varying lighting conditions.
* **Dynamic Signal Control Algorithm:** Automatically adjusts green signal durations proportionally based on lane queue lengths and density thresholds.
* **Embedded Hardware Integration:** Custom Arduino circuit controlling physical traffic light LEDs synchronized with the computer vision engine.
* **Web Telemetry Dashboard:** Responsive React.js frontend displaying vehicle counts, current signal states, lane occupancy graphs, and system health.
* **Modular Codebase:** Decoupled architecture allowing independent execution, testing, and deployment of backend, frontend, and hardware modules.

---

## 🛠️ Tech Stack & Dependencies

| Layer | Component | Description & Key Libraries |
| :--- | :--- | :--- |
| **Artificial Intelligence** | Python 3.9+ | Ultralytics YOLOv8, PyTorch, OpenCV, NumPy |
| **Backend & Communication** | Python / FastAPI | PySerial, Uvicorn, REST API endpoints |
| **Frontend Dashboard** | React.js | HTML5, CSS3, JavaScript (ES6+), Axios, Chart.js |
| **Embedded System** | Arduino (C++) | Arduino IDE, Serial Communication Protocols |
| **Documentation** | LaTeX | IEEE-compliant academic report & poster design |

---

## 📂 Repository Layout

```text
bachelors-thesis-traffic-management/
│
├── 📂 arduino/                  # Embedded software
│   ├── traffic_light_control.ino# Main C++ sketch for LED logic and Serial receiver
│   └── circuit_diagram.png      # Circuit connection schematic
│
├── 📂 backend/                  # AI engine and API server
│   ├── config/                  # System parameters and threshold configurations
│   ├── models/                  # YOLOv8 weight files directory (*.pt)
│   ├── utils/                   # Frame preprocessing and counting pipelines
│   ├── main.py                  # API server and core application entry point
│   └── requirements.txt         # Python package dependencies
│
├── 📂 frontend/                 # React web application
│   ├── public/                  # Static assets
│   ├── src/                     # React components, dashboard UI, API services
│   └── package.json             # Node.js dependencies and scripts
│
├── 📂 docs/                     # Academic deliverables
│   ├── Graduation_Thesis_Report.pdf
│   └── Academic_Presentation_Poster.pdf
│
├── .gitignore                   # Excluded build files, virtual environments, weights
└── README.md                    # System documentation

```

---

## ⚡ Quick Start & Installation

### Prerequisites

* **Python** 3.9 or higher
* **Node.js** (v16.x or higher) & **npm**
* **Arduino IDE** (for flashing embedded hardware)
* **Git**

---

### 1. Backend Setup (AI & Detection Engine)

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate

# Install required Python packages
pip install -r requirements.txt

# Start the backend processing pipeline
python main.py

```

> **Note:** Ensure your trained model weights file (`best.pt`) is placed in `backend/models/`. If downloading from external storage, update the model path in `backend/config/settings.yaml`.

---

### 2. Frontend Setup (React Dashboard)

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Launch web dashboard in development mode
npm start

```

The interface will automatically open at `http://localhost:3000`.

---

### 3. Hardware Deployment (Arduino)

1. Connect your Arduino board via USB.
2. Open `arduino/traffic_light_control.ino` in the Arduino IDE.
3. Select your board and corresponding COM port under **Tools**.
4. Upload the sketch to the board.
5. Ensure the COM port setting in `backend/config/settings.yaml` matches your connected Arduino port.

---

## 📊 System Performance & Metrics

* **Detection Accuracy (mAP@50):** ~92.4% on custom traffic video datasets.
* **Inference Speed:** ~35-45 FPS on standard GPU setups (NVIDIA CUDA acceleration supported).
* **Hardware Response Latency:** < 150ms over Serial UART communication.

---

## 🎓 Academic Credits & Acknowledgments

This research and implementation were completed as a Bachelor's Degree Graduation Thesis.

* **Author:** Sedat Eroğlu ([@sedaterogluu](https://github.com/sedaterogluu))
* **Thesis Advisor:** Assoc. Prof. Dr. Hakan Aktaş
* **Institution:** Niğde Ömer Halisdemir University
* **Department:** Faculty of Engineering, Department of Computer Engineering
* **Project Period:** September 2025 – June 2026
* **Contact:** [seroglu076@gmail.com](https://www.google.com/search?q=mailto%3Aseroglu076%40gmail.com)

```

```

