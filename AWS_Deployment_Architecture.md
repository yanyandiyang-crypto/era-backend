# AWS Backend Deployment Architecture

## 🚀 Deployment Overview

This diagram shows the complete AWS architecture for deploying the ERA Backend System.

```
┌─────────────────────────────────────────┐
│                AWS Cloud                │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐     ┌─────────────┐    │
│  │ Route 53    │     │ CloudFront  │    │
│  │ (DNS)       │     │ (CDN)       │    │
│  └───────┬─────┘     └───────▲─────┘    │
│          │                   │          │
│          └───────────────────┼──────────┘
│                              │
│  ┌─────────────┐     ┌───────▼────────┐
│  │ALB/Load     │◄────┤ API Gateway    │
│  │Balancer     │     │ (Optional)     │
│  └───────┬─────┘     └────────────────┘
│          │
│          ▼
│  ┌─────────────────────────────────────┐
│  │          ECS Fargate Cluster        │
│  │                                     │
│  │  ┌─────────────────────────────────┐ │
│  │  │     Backend Application         │ │
│  │  │   • Node.js + TypeScript        │ │
│  │  │   • Fastify Framework           │ │
│  │  │   • Prisma + PostgreSQL         │ │
│  │  │   • WebSocket Real-time         │ │
│  │  └─────────────────────────────────┘ │
│  └─────────────────────────────────────┘
│
│  ┌─────────────────────────────────────┐
│  │          RDS PostgreSQL             │
│  │                                     │
│  │  • Prisma Migrations                │
│  │  • Connection Pooling               │
│  │  • Multi-AZ (Production)            │
│  └─────────────────────────────────────┘
│
│  ┌─────────────────────────────────────┐
│  │            S3 Buckets               │
│  │                                     │
│  │  • uploads/ - Incident Photos       │
│  │  • backups/ - Database Backups      │
│  │  • logs/ - Application Logs         │
│  └─────────────────────────────────────┘
│
│  ┌─────────────────────────────────────┐
│  │         CloudWatch/ECS Logs         │
│  │                                     │
│  │  • Application Logs                 │
│  │  • Container Metrics                │
│  │  • Health Checks                    │
│  └─────────────────────────────────────┘
│
└─────────────────────────────────────────┘
```

## 🧪 EC2 Testing Setup

For quick testing and development, you can deploy the ERA Backend to a single EC2 instance instead of the full ECS production setup. This provides a simpler, more accessible environment for testing features, debugging, and integration testing.

### Quick EC2 Testing Deployment

#### 1. Launch EC2 Instance
1. Go to **EC2** service → **Instances** → **Launch instances**
2. Name: `era-backend-test`
3. AMI: **Amazon Linux 2** or **Ubuntu Server 22.04 LTS**
4. Instance type: `t3.micro` (free tier)
5. Key pair: Create new key pair
   - Name: `era-backend-test-key`
   - Type: **Ed25519** (recommended)
   - Format: **.pem**
6. Network settings:
   - VPC: Default
   - Auto-assign public IP: **Enable**
   - Security group: Create new
     - Allow SSH (22) from your IP
     - Allow HTTP (80) and HTTPS (443) if needed
     - Allow Custom TCP (3000) from anywhere (for testing)
7. Storage: 20 GB gp2
8. Launch instance

#### 2. Connect to EC2 Instance
```bash
# Set permissions on key
chmod 400 era-backend-test-key.pem

# Connect via SSH
ssh -i era-backend-test-key.pem ec2-user@YOUR_INSTANCE_PUBLIC_IP
```

#### 3. Install Dependencies on EC2
```bash
# Update system
sudo yum update -y  # Amazon Linux
# or for Ubuntu:
# sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install PostgreSQL
# Amazon Linux:
sudo yum install -y postgresql postgresql-server postgresql-devel
sudo postgresql-setup initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Ubuntu:
# sudo apt install -y postgresql postgresql-contrib libpq-dev
# sudo systemctl start postgresql
# sudo systemctl enable postgresql

# Install Git
sudo yum install -y git  # Amazon Linux
# or for Ubuntu:
# sudo apt install -y git

# Install PM2 for process management
sudo npm install -g pm2
```

#### 4. Set Up Database
```bash
# Create database and user
sudo -u postgres psql
CREATE DATABASE era_test;
CREATE USER era_user WITH PASSWORD 'your_secure_test_password';
GRANT ALL PRIVILEGES ON DATABASE era_test TO era_user;
ALTER USER era_user CREATEDB;
\q
```

#### 5. Deploy Application
```bash
# Clone repository
git clone https://github.com/your-repo/era-backend.git
cd era-backend

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with test values:
# NODE_ENV=development
# DATABASE_URL="postgresql://era_user:your_password@localhost:5432/era_test"
# PORT=3000
# HOST=0.0.0.0
# FRONTEND_URL="http://your-test-frontend-url"
# Generate new JWT secrets

# Generate Prisma client and run migrations
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed

# Start application with PM2
pm2 start npm --name "era-backend-test" -- run dev
pm2 save
pm2 startup
```

#### 6. Test the Deployment
```bash
# Check if app is running
curl http://localhost:3000/health

# View logs
pm2 logs era-backend-test

# Monitor resources
pm2 monit
```

### EC2 Testing Script

```bash
#!/bin/bash

# EC2 Testing Setup Script for ERA Backend
# Run this script on your EC2 instance after connecting via SSH

echo "🚀 Setting up ERA Backend for Testing on EC2"

# Update system
echo "📦 Updating system..."
# Detect OS
if command -v yum &> /dev/null; then
    # Amazon Linux
    sudo yum update -y
    PACKAGE_MANAGER="yum"
elif command -v apt &> /dev/null; then
    # Ubuntu
    sudo apt update && sudo apt upgrade -y
    PACKAGE_MANAGER="apt"
else
    echo "❌ Unsupported OS. This script supports Amazon Linux and Ubuntu."
    exit 1
fi

# Install Node.js
echo "📦 Installing Node.js..."
if [ "$PACKAGE_MANAGER" = "yum" ]; then
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
    sudo yum install -y nodejs
else
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install PostgreSQL
echo "📦 Installing PostgreSQL..."
if [ "$PACKAGE_MANAGER" = "yum" ]; then
    sudo yum install -y postgresql postgresql-server postgresql-devel
    sudo postgresql-setup initdb
else
    sudo apt install -y postgresql postgresql-contrib libpq-dev
fi
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Install Git and PM2
echo "📦 Installing Git and PM2..."
if [ "$PACKAGE_MANAGER" = "yum" ]; then
    sudo yum install -y git
else
    sudo apt install -y git
fi
sudo npm install -g pm2

# Set up database
echo "🗄️ Setting up database..."
sudo -u postgres psql -c "CREATE DATABASE era_test;"
sudo -u postgres psql -c "CREATE USER era_user WITH PASSWORD 'test_password_123';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE era_test TO era_user;"
sudo -u postgres psql -c "ALTER USER era_user CREATEDB;"

# Clone and setup application
echo "📥 Cloning and setting up application..."
git clone https://github.com/your-repo/era-backend.git
cd era-backend
npm install

# Configure environment
cp .env.example .env
# Note: Manually edit .env file with your test values

echo "✅ Setup complete! Please:"
echo "1. Edit the .env file with your test configuration"
echo "2. Run: npm run prisma:generate && npm run prisma:migrate && npm run prisma:seed"
echo "3. Start the app: pm2 start npm --name 'era-backend-test' -- run dev"
```

### Testing Checklist
- [ ] EC2 instance launched and accessible
- [ ] SSH connection working
- [ ] Node.js and PostgreSQL installed
- [ ] Database created and configured
- [ ] Application cloned and dependencies installed
- [ ] Environment variables configured
- [ ] Prisma migrations run
- [ ] Application starts without errors
- [ ] API endpoints accessible
- [ ] Database connections working
- [ ] File uploads functional (if testing)

### Cost for Testing
- **EC2 t3.micro**: ~$8-10/month (if running 24/7)
- **EBS Storage**: ~$2/month
- **Data Transfer**: Minimal for testing

**Total Testing Cost**: ~$10-12/month

## 📋 Deployment Steps (AWS Console Method)

### Phase 1: AWS Account Setup & Prerequisites

1. **Sign into AWS Console** → Go to https://console.aws.amazon.com/
2. **Enable billing alerts** (optional but recommended)
3. **Create IAM User** (if not using root account):
   - IAM → Users → Create user
   - Attach policy: `AmazonECSTaskExecutionRolePolicy`
   - Save Access Key and Secret Key for reference
4. **Choose region**: `ap-southeast-1` (Asia Pacific - Singapore)
5. **Install Docker locally** (for building container):
   ```bash
   # Ubuntu/Debian
   sudo apt-get update && sudo apt-get install docker.io

   # Or download from: https://www.docker.com/products/docker-desktop/
   ```

### Phase 2: Infrastructure Setup (AWS Console)

#### 2.1 Create ECR Repository (Docker Container Registry)
1. Go to **ECR** service → **Repositories**
2. Click **Create repository**
3. Repository name: `era-backend`
4. Visibility settings: **Private**
5. Click **Create repository**
6. Note the repository URI for later

#### 2.2 Create RDS PostgreSQL Database
1. Go to **RDS** service → **Databases**
2. Click **Create database**
3. Choose **Standard create**
4. Engine type: **PostgreSQL**
5. Version: **15.x** (latest available)
6. Templates: **Free tier** (or Production for real deployment)
7. DB instance identifier: `era-database`
8. Master username: `era_user`
9. Auto generate password: **ON** (save the password)
10. Instance configuration:
    - Instance class: `db.t3.micro` (Free tier)
    - Storage: 20 GB (gp2)
11. Connectivity:
    - VPC: Default VPC
    - Public access: **No** (for security)
12. Additional configuration:
    - Initial database name: `era_prod`
13. Click **Create database**
14. Wait for creation to complete (~10-15 minutes)

#### 2.3 Create S3 Buckets
1. Go to **S3** service → **Buckets**
2. Click **Create bucket**
3. Bucket name: `era-uploads` (must be globally unique)
4. Region: `Asia Pacific (Singapore) ap-southeast-1`
5. Block all public access: **ON**
6. Click **Create bucket**
7. Repeat for `era-backups` and `era-logs` buckets

### Phase 3: Application Deployment (AWS Console)

#### 3.1 Build and Push Docker Image to ECR

**Local Steps (Build & Push):**
```bash
# 1. Build Docker Image
cd backend
docker build -t era-backend:latest .

# 2. Authenticate with ECR
# Get the login command from ECR Console → era-backend repo → View push commands
# Copy and run the docker login command

# 3. Tag and Push Image
# Follow the push commands shown in ECR Console
docker tag era-backend:latest YOUR_ECR_URI/era-backend:latest
docker push YOUR_ECR_URI/era-backend:latest
```

**AWS Console Steps:**
1. Go to **ECR** service → **era-backend** repository
2. Click **View push commands**
3. Follow the instructions for local machine

#### 3.2 Create ECS Cluster
1. Go to **ECS** service → **Clusters**
2. Click **Create Cluster**
3. Cluster name: `era-backend-cluster`
4. Infrastructure: **AWS Fargate (serverless)**
5. Click **Create cluster**

#### 3.3 Create Task Definition
1. Go to **ECS** → **Task Definitions**
2. Click **Create new Task Definition**
3. Select **Fargate**
4. Task definition family: `era-backend-task`
5. Task role: **Create new role** (ECS task execution role)
6. Network mode: **awsvpc**
7. Operating system: **Linux**
8. CPU: **0.5 vCPU** (512)
9. Memory: **1 GB**
10. Click **Add container**
    - Container name: `era-backend`
    - Image: `YOUR_ECR_URI/era-backend:latest`
    - Memory limits: **Soft limit 1024**
    - Port mappings: **3000** (container port)
11. Environment variables:
    - `DATABASE_URL`: `postgresql://era_user:PASSWORD@[RDS_ENDPOINT]:5432/era_prod`
    - Add other environment variables from section 4 below
12. Log configuration: **awslogs**
    - awslogs-group: `era-backend-logs`
    - awslogs-region: `ap-southeast-1`
    - awslogs-stream-prefix: `ecs`
13. Click **Create**

#### 3.4 Create Application Load Balancer (ALB)
1. Go to **EC2** → **Load Balancers**
2. Click **Create load balancer**
3. Choose **Application Load Balancer**
4. Basic configuration:
   - Name: `era-backend-alb`
   - Scheme: **internet-facing**
   - IP address type: **ipv4**
5. Network mapping:
   - VPC: Your default VPC
   - Mappings: Select 2 availability zones
6. Security groups: Create new security group allowing port 80/443
7. Listeners and routing: Add HTTP listener on port 80
8. Click **Create load balancer**

#### 3.5 Create ECS Service
1. Go to **ECS** → **Clusters** → **era-backend-cluster**
2. Click **Create service**
3. Environment: **AWS Fargate**
4. Task Definition: **era-backend-task**
5. Service name: `era-backend-service`
6. Desired tasks: **2**
7. Networking:
   - VPC: Default VPC
   - Subnets: Select all available subnets
   - Security group: Create new one allowing port 3000
   - Public IP: **ON**
8. Load balancing:
   - Application Load Balancer: **era-backend-alb**
   - Container name and port: **era-backend:3000**
9. Service auto scaling: **Do not adjust** (for now)
10. Click **Create service**

### Phase 4: Environment Configuration (AWS Console)

#### 4.1 Store Environment Variables in AWS Systems Manager
1. Go to **Systems Manager** service → **Parameter Store**
2. Click **Create parameter**
3. Create the following parameters:
   - Name: `/era-backend/JWT_ACCESS_SECRET`
   - Value: `(generate a 256-character random string)`
   - Type: **SecureString**
4. Repeat for:
   - `/era-backend/JWT_REFRESH_SECRET`: `(256-character random string)`
   - `/era-backend/GOOGLE_MAPS_API_KEY`: `your-production-google-maps-key`
   - `/era-backend/AWS_ACCESS_KEY_ID`: Your AWS Access Key
   - `/era-backend/AWS_SECRET_ACCESS_KEY`: Your AWS Secret Key

#### 4.2 Update ECS Task Definition with Environment Variables
1. Go to **ECS** → **Task Definitions** → **era-backend-task**
2. Click **Create new revision**
3. In the container configuration, under **Environment variables**:
   - `NODE_ENV`: `production`
   - `PORT`: `3000`
   - `HOST`: `0.0.0.0`
   - `FRONTEND_URL`: `https://yourdomain.com,https://admin.yourdomain.com`
   - `UPLOAD_DIR`: `./uploads`
   - `MAX_FILE_SIZE`: `5242880`
   - `AWS_REGION`: `ap-southeast-1`
   - `S3_UPLOAD_BUCKET`: `era-uploads`
   - `S3_BACKUP_BUCKET`: `era-backups`
4. Add **Environment variables from SSM**:
   - `/era-backend/JWT_ACCESS_SECRET`
   - `/era-backend/JWT_REFRESH_SECRET`
   - `/era-backend/GOOGLE_MAPS_API_KEY`

### Phase 5: Database Setup (AWS Console)

#### 5.1 Set Up Database Connection
1. **Get RDS endpoint**: RDS → Databases → era-database → Connectivity
2. **Note the endpoint and port** (typically port 5432)
3. **Get database password** from RDS or your saved password

#### 5.2 Run Database Setup (Local Terminal)
```bash
# 1. Install Prisma CLI if not already installed
npm install -g prisma

# 2. Update your local .env with production database URL
DATABASE_URL="postgresql://era_user:YOUR_RDS_PASSWORD@[RDS_ENDPOINT]:5432/era_prod"

# 3. Deploy migrations
npx prisma migrate deploy

# 4. Seed initial data (optional)
npx prisma db seed
```

**Note**: Database migrations need to be run from a machine with access to the database. You can:
- Set your RDS to "Public access: Yes" temporarily for setup
- Or use AWS Systems Manager Session Manager to connect through bastion host
- Or connect through an EC2 instance in your VPC

### Phase 6: Monitoring & Security (AWS Console)

#### 6.1 Set Up CloudWatch Logs
1. Go to **CloudWatch** service → **Logs** → **Log groups**
2. Click **Create log group**
3. Name: `era-backend-logs`
4. Retention: **1 month** (or as needed)
5. Click **Create**

#### 6.2 Create CloudWatch Alarms
1. Go to **CloudWatch** → **Alarms**
2. Click **Create alarm** → **Select metric**
3. Choose **ECS** service → **ClusterName** → **era-backend-cluster**
4. Select metrics:
   - **CPUUtilization** 
   - **MemoryUtilization**
5. Set thresholds and notification (optional)
6. Create alarm

#### 6.3 Configure Security (Important!)
1. Go to **EC2** → **Security Groups**
2. Find the **ECS service security group** (created during service setup)
3. Edit inbound rules:
   - Source type: **Custom**
   - Source: **ALB Security Group ID**
   - Port: **3000**
4. **Remove any "0.0.0.0/0" (anywhere)** access for security

#### 6.4 Optional: Set Up Auto Scaling
1. Go to **ECS** → Clusters → **era-backend-cluster** → **era-backend-service**
2. Click **Update service**
3. Go to **Auto scaling** section
4. Set up scaling policies based on CPU/memory usage

## 🔧 Configuration Files

### Dockerfile
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy built application and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]
```

### ECS Task Definition (task-definition.json)
```json
{
  "family": "era-backend-task",
  "taskRoleArn": "arn:aws:iam::YOUR_ACCOUNT_ID:role/ecsTaskExecutionRole",
  "executionRoleArn": "arn:aws:iam::YOUR_ACCOUNT_ID:role/ecsTaskExecutionRole",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "era-backend",
      "image": "YOUR_ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/era-backend:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "hostPort": 3000,
          "protocol": "tcp"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "era-backend-logs",
          "awslogs-region": "ap-southeast-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "environment": [
        {
          "name": "DATABASE_URL",
          "value": "postgresql://era_user:YourSecurePassword123!@[RDS_ENDPOINT]:5432/era_prod"
        }
      ],
      "secrets": [
        {
          "name": "JWT_ACCESS_SECRET",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-1:YOUR_ACCOUNT_ID:secret:era-backend-jwt-access"
        },
        {
          "name": "JWT_REFRESH_SECRET",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-1:YOUR_ACCOUNT_ID:secret:era-backend-jwt-refresh"
        }
      ]
    }
  ]
}
```

## 🚀 Quick Deployment Script

```bash
#!/bin/bash

# Quick AWS Backend Deployment Script

echo "🚀 ERA Backend AWS Deployment"

# Build and push Docker image
echo "📦 Building and pushing Docker image..."
docker build -t era-backend:latest .
docker tag era-backend:latest YOUR_ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/era-backend:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/era-backend:latest

# Deploy to ECS
echo "🚀 Deploying to ECS..."
aws ecs update-service \
    --cluster era-backend-cluster \
    --service era-backend-service \
    --force-new-deployment

echo "✅ Deployment initiated! Check AWS console for status."
```

## 🔍 Monitoring & Troubleshooting

### Health Checks
- Application health: `GET /health`
- Database connectivity: Check CloudWatch logs
- Container health: ECS container insights

### Common Issues
1. **Database Connection**: Check security groups allow RDS access
2. **Environment Variables**: Verify secrets in AWS Secrets Manager
3. **File Uploads**: Ensure S3 bucket permissions are correct
4. **WebSocket**: Confirm ALB sticky sessions for WebSocket connections

### Scaling
```bash
# Scale ECS service
aws ecs update-service \
    --cluster era-backend-cluster \
    --service era-backend-service \
    --desired-count 3

# Auto-scaling (set up via AWS console or CLI)
# Scale based on CPU/Memory utilization
```

## 💰 Cost Estimation (Monthly)

- **ECS Fargate**: ~$20-50 (2-4 vCPU, based on usage)
- **RDS PostgreSQL**: ~$30-60 (t3.micro with Multi-AZ)
- **S3 Storage**: ~$1-5 (file uploads, minimal usage)
- **CloudWatch Logs**: ~$1-5
- **Load Balancer**: ~$15-20
- **Data Transfer**: ~$5-15

**Total Estimated Cost**: $70-150/month (depending on traffic)
