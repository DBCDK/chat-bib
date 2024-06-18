#!groovy​

def app
def imageName="chat-bib"
def imageLabel=BUILD_NUMBER

pipeline {
    agent {
        label 'devel10'
    }
    triggers{
        // @TODO parameters on githubPush .. eg. branch
        githubPush()

    }
    environment {
        DOCKER_TAG = "${imageLabel}"
        IMAGE = "${imageName}${env.BRANCH_NAME != 'main' ? "-${env.BRANCH_NAME.toLowerCase()}" : ''}:${BUILD_NUMBER}"
        DOCKER_COMPOSE_NAME = "compose-${IMAGE}"
        // we need to use metascrums gitlab token .. for the metascrum bot in deploy stage
        GITLAB_PRIVATE_TOKEN = credentials("metascrum-gitlab-api-token")
        REPOSITORY = "https://docker-ai.artifacts.dbccloud.dk"
    }
    stages {
        stage('Build image') {
            steps { script {
                // Work around bug https://issues.jenkins-ci.org/browse/JENKINS-44609 , https://issues.jenkins-ci.org/browse/JENKINS-44789
                sh "docker build -t ${IMAGE} --pull --no-cache ."
                app = docker.image("${IMAGE}")
            } }
        }
        stage('Push to Artifactory') {
           when {
               anyOf {
                   branch 'main'
                   branch 'prod'
               }
           }
            steps {
                script {
                    if (currentBuild.resultIsBetterOrEqualTo('SUCCESS')) {
                        docker.withRegistry("${REPOSITORY}", 'docker') {
                            app.push()
                            app.push("latest")
                        }
                    }
                } }
        }
    }
    post {
        always {
               sh """
                    echo Clean up
                    #docker-compose -f docker-compose-cypress.yml -p ${DOCKER_COMPOSE_NAME} down -v
                    docker rmi $IMAGE
                """
        }  
    }
}
