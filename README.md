CrisisManagement

A platform for real-time monitoring and management of global crisis events.
It collects, processes, and visualizes crisis-related data through workflows, automation, and containerized microservices.

🌍 What It Does

Fetches and aggregates crisis-related data (news, RSS feeds, alerts).

Cleans, filters, and stores the data in MongoDB.

Defines automated workflows to process and manage crisis information.

Runs on Docker Compose with multiple services working together.

Provides a scalable base for building dashboards, alerts, or visual maps of crisis locations.

🛠️ Technologies Used

Docker & Docker Compose → containerized deployment

MongoDB → database for storing crisis data

Node.js / JavaScript services → backend microservices

n8n Workflows (JSON) → automation workflows for ingestion & cleanup

APIs & Integrations

RSS Feeds (news sources for crises)

External APIs (can be extended for Twitter, weather, finance, etc.)

📂 Repository Structure
.
├── cleanup_workflow.json     # Automation to clean & maintain database entries
├── crisis_workflow.json      # Main crisis ingestion & monitoring workflow
├── docker-compose.yml        # Defines all services (MongoDB + microservices)
├── mongo-init/               # Database initialization scripts
│   └── init.js
├── services/                 # Core service code (data fetching, processing, APIs)
│   ├── ingestion/            # Example: data fetching logic
│   ├── processing/           # Example: filtering / transformation
│   └── api/                  # Example: exposes endpoints
├── hackerathon-start/        # Early prototype/demo project code
└── .gitignore

🚀 How It Works

Workflows (crisis_workflow.json) define how data is fetched, processed, and stored.

Microservices (in services/) handle ingestion, processing, and APIs.

MongoDB stores structured crisis data for querying and visualization.

Cleanup workflows (cleanup_workflow.json) keep the database optimized.

All services run together with docker-compose, making the system modular and scalable.
