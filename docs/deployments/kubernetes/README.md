# Deploying with Kubernetes.

In the [quality-dashboard] directory, you will find an example of deployment using Yaml files (with Kustomize)

To Launch the application in Kubenetes:

```bash
git clone https://github.com/DidierHoarau/quality-dashboard
cd quality-dashboard/docs/deployments/kubernetes/quality-dashboard
kubectl kustomize . | kubectl apply -f -
```
