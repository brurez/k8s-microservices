docker build -t brurez/docker-complex-client:latest -t brurez/docker-complex-client:$SHA -f ./client/Dockerfile ./client
docker build -t brurez/docker-complex-server:latest -t brurez/docker-complex-server:$SHA -f ./server/Dockerfile ./server
docker build -t brurez/docker-complex-worker:latest -t brurez/docker-complex-worker:$SHA -f ./worker/Dockerfile ./worker

docker push brurez/docker-complex-client:latest
docker push brurez/docker-complex-server:latest
docker push brurez/docker-complex-worker:latest

docker push brurez/docker-complex-client:$SHA
docker push brurez/docker-complex-server:$SHA
docker push brurez/docker-complex-worker:$SHA

kubectl apply -f k8s
kubectl set image deployments/client-deployment server=brurez/docker-complex-client:$SHA
kubectl set image deployments/server-deployment server=brurez/docker-complex-server:$SHA
kubectl set image deployments/worker-deployment server=brurez/docker-complex-worker:$SHA
