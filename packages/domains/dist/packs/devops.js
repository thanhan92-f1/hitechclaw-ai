import { defineDomainPack } from '../base/domain-pack.js';
// ─── Jenkins Pipeline Templates ─────────────────────────────
const JENKINS_TEMPLATES = {
    declarative: (steps) => `pipeline {
    agent any

    environment {
        CI = 'true'
        NODE_ENV = 'production'
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
${steps.includes('lint') ? `        stage('Lint') {
            steps {
                sh 'npm run lint'
            }
        }
` : ''}${steps.includes('test') ? `        stage('Test') {
            steps {
                sh 'npm test'
            }
            post {
                always {
                    junit '**/test-results/*.xml'
                }
            }
        }
` : ''}${steps.includes('build') ? `        stage('Build') {
            steps {
                sh 'npm run build'
            }
            post {
                success {
                    archiveArtifacts artifacts: 'dist/**/*', fingerprint: true
                }
            }
        }
` : ''}${steps.includes('docker') ? `        stage('Docker Build') {
            steps {
                script {
                    def image = docker.build("$` + `{env.DOCKER_REGISTRY}/$` + `{env.IMAGE_NAME}:$` + `{env.BUILD_NUMBER}")
                    docker.withRegistry('https://registry.hub.docker.com', 'docker-credentials') {
                        image.push()
                        image.push('latest')
                    }
                }
            }
        }
` : ''}${steps.includes('deploy') ? `        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                sh './scripts/deploy.sh'
            }
        }
` : ''}    }

    post {
        failure {
            echo 'Pipeline failed!'
        }
        success {
            echo 'Pipeline succeeded!'
        }
        always {
            cleanWs()
        }
    }
}`,
    scripted: (steps) => `node {
    def buildNumber = env.BUILD_NUMBER

    try {
${steps.includes('lint') ? `        stage('Lint') {
            sh 'npm run lint'
        }
` : ''}${steps.includes('test') ? `        stage('Test') {
            sh 'npm test'
            junit '**/test-results/*.xml'
        }
` : ''}${steps.includes('build') ? `        stage('Build') {
            sh 'npm run build'
            archiveArtifacts artifacts: 'dist/**/*'
        }
` : ''}${steps.includes('deploy') ? `        stage('Deploy') {
            if (env.BRANCH_NAME == 'main') {
                sh './scripts/deploy.sh'
            }
        }
` : ''}    } catch (e) {
        currentBuild.result = 'FAILURE'
        throw e
    } finally {
        cleanWs()
    }
}`,
};
// ─── Dockerfile Templates ───────────────────────────────────
const DOCKERFILE_TEMPLATES = {
    node: (fw, ms) => ms ? `# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S appuser && adduser -S appuser -u 1001
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
USER appuser
EXPOSE 3000
CMD ["node", "dist/index.js"]` : `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]`,
    python: (fw, ms) => `FROM python:3.12-slim
WORKDIR /app
RUN adduser --disabled-password --gecos "" appuser
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
USER appuser
EXPOSE 8000
CMD ["${fw === 'django' ? 'gunicorn' : 'uvicorn'}", "${fw === 'django' ? 'config.wsgi:application' : 'main:app'}", "--host", "0.0.0.0", "--port", "8000"]`,
    go: (_fw, ms) => ms ? `FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/server .

FROM alpine:3.19
RUN adduser -D -u 1001 appuser
COPY --from=builder /app/server /server
USER appuser
EXPOSE 8080
ENTRYPOINT ["/server"]` : `FROM golang:1.22-alpine
WORKDIR /app
COPY . .
RUN go build -o server .
EXPOSE 8080
CMD ["./server"]`,
    java: (fw, ms) => `FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY . .
RUN ${fw === 'gradle' ? './gradlew bootJar' : './mvnw package -DskipTests'}

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/${fw === 'gradle' ? 'build/libs/*.jar' : 'target/*.jar'} app.jar
RUN adduser -D -u 1001 appuser
USER appuser
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]`,
    rust: (_fw, ms) => `FROM rust:1.77-alpine AS builder
WORKDIR /app
RUN apk add --no-cache musl-dev
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src
COPY . .
RUN cargo build --release

FROM alpine:3.19
COPY --from=builder /app/target/release/app /usr/local/bin/app
RUN adduser -D -u 1001 appuser
USER appuser
EXPOSE 8080
ENTRYPOINT ["app"]`,
};
// ─── Docker Compose Templates ───────────────────────────────
function generateDockerCompose(services) {
    const svcMap = {
        postgres: `  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: app
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      timeout: 5s
      retries: 5`,
        redis: `  redis:
    image: redis:8-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s`,
        nginx: `  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf`,
        mongodb: `  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongodata:/data/db`,
        rabbitmq: `  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"`,
    };
    const lines = ['services:'];
    const volumes = [];
    for (const svc of services) {
        const key = svc.toLowerCase().trim();
        if (svcMap[key]) {
            lines.push(svcMap[key]);
            if (key === 'postgres')
                volumes.push('  pgdata:');
            if (key === 'mongodb')
                volumes.push('  mongodata:');
        }
    }
    if (volumes.length) {
        lines.push('', 'volumes:', ...volumes);
    }
    return lines.join('\n');
}
export const devopsDomain = defineDomainPack({
    id: 'devops',
    name: 'DevOps & Infrastructure',
    description: 'CI/CD pipelines, cloud infrastructure, monitoring, Docker/Kubernetes, and system administration.',
    icon: '⚙️',
    skills: [
        {
            id: 'jenkins',
            name: 'Jenkins Pipeline Builder',
            description: 'Generate, validate, and manage Jenkins CI/CD pipelines.',
            version: '1.0.0',
            category: 'ci-cd',
            tools: [
                {
                    name: 'generate_jenkinsfile',
                    description: 'Generate a Jenkins pipeline (Declarative or Scripted).',
                    parameters: {
                        type: 'object',
                        properties: {
                            style: { type: 'string', description: 'declarative or scripted' },
                            steps: { type: 'array', items: { type: 'string' }, description: 'Pipeline steps: lint, test, build, docker, deploy' },
                            runtime: { type: 'string', description: 'node, python, java, go (affects build commands)' },
                        },
                        required: ['steps'],
                    },
                    execute: async (params) => {
                        const style = (params.style || 'declarative');
                        const steps = Array.isArray(params.steps) ? params.steps : ['lint', 'test', 'build'];
                        const template = JENKINS_TEMPLATES[style] || JENKINS_TEMPLATES.declarative;
                        return {
                            success: true,
                            data: {
                                jenkinsfile: template(steps),
                                style,
                                steps,
                                filename: 'Jenkinsfile',
                            },
                        };
                    },
                },
                {
                    name: 'generate_ci_pipeline',
                    description: 'Generate CI/CD pipeline for GitHub Actions, GitLab CI, or CircleCI.',
                    parameters: {
                        type: 'object',
                        properties: {
                            platform: { type: 'string', description: 'github-actions, gitlab-ci, circleci' },
                            steps: { type: 'array', items: { type: 'string' }, description: 'Pipeline steps: lint, test, build, deploy' },
                        },
                        required: ['platform'],
                    },
                    execute: async (params) => {
                        const steps = Array.isArray(params.steps) ? params.steps : ['lint', 'test', 'build'];
                        return {
                            success: true,
                            data: { _llmTool: true, toolPrompt: `Generate a ${params.platform} CI/CD pipeline configuration with these steps: ${steps.join(', ')}. Include caching, parallel jobs where appropriate, and deployment stages.` },
                        };
                    },
                },
            ],
        },
        {
            id: 'docker',
            name: 'Docker & Containers',
            description: 'Generate Dockerfiles, docker-compose configs, and container infrastructure.',
            version: '1.0.0',
            category: 'containers',
            tools: [
                {
                    name: 'generate_dockerfile',
                    description: 'Generate an optimized Dockerfile for a project.',
                    parameters: {
                        type: 'object',
                        properties: {
                            runtime: { type: 'string', description: 'node, python, go, java, rust' },
                            framework: { type: 'string', description: 'Express, Django, Flask, Spring, etc.' },
                            multiStage: { type: 'boolean', description: 'Use multi-stage build (recommended)' },
                        },
                        required: ['runtime'],
                    },
                    execute: async (params) => {
                        const runtime = (params.runtime || 'node').toLowerCase();
                        const framework = params.framework || '';
                        const multiStage = params.multiStage !== false;
                        const template = DOCKERFILE_TEMPLATES[runtime];
                        if (template) {
                            return {
                                success: true,
                                data: {
                                    dockerfile: template(framework, multiStage),
                                    runtime,
                                    multiStage,
                                    filename: 'Dockerfile',
                                },
                            };
                        }
                        return {
                            success: true,
                            data: { _llmTool: true, toolPrompt: `Generate an optimized ${multiStage ? 'multi-stage ' : ''}Dockerfile for a ${runtime} project${framework ? ` using ${framework}` : ''}. Include security best practices and minimal image size.` },
                        };
                    },
                },
                {
                    name: 'generate_docker_compose',
                    description: 'Generate a docker-compose.yml with common services.',
                    parameters: {
                        type: 'object',
                        properties: {
                            services: { type: 'array', items: { type: 'string' }, description: 'Services: postgres, redis, nginx, mongodb, rabbitmq' },
                        },
                        required: ['services'],
                    },
                    execute: async (params) => {
                        const services = Array.isArray(params.services) ? params.services : ['postgres', 'redis'];
                        return {
                            success: true,
                            data: {
                                compose: generateDockerCompose(services),
                                services,
                                filename: 'docker-compose.yml',
                            },
                        };
                    },
                },
            ],
        },
    ],
    agentPersona: `You are HiTechClaw DevOps, an AI assistant specializing in DevOps practices, cloud infrastructure, CI/CD pipelines, and system reliability engineering.

Follow DevOps best practices:
- Infrastructure as Code (IaC)
- Least privilege access principles
- Container security best practices
- Monitoring and observability
- Immutable deployments where possible`,
    recommendedIntegrations: ['github', 'slack-api'],
});
//# sourceMappingURL=devops.js.map