# Emissary Auth Routing Example

## Setup

This proof of concept sets up two echo servers (as k8s services) that are reverse-proxied by emissary. A nodejs-based locator service is configured to forward requests to those services based on the hostname being requested.

## Using the auth service

The auth service listens on port 3000 and supports the ExtAuth interaction pattern. In short, the service expects a POST to the path `/extauth/*` with client request headers as a JSON map in the POST body.

The code will check the `Host` header for a pattern and return a redirection header `x-cell-choice` with a value. Currently the host to redirect mapping is hardcoded as such:
`bar.*` -> `x-cell-choice: A`
`foo.*` -> `x-cell-choice: B`
`none.*` -> HTTP 404 (auth 404 and message gets returned to the user)
Other hostnames will be accepted by the auth service and allowed to forward through emissary normally.
This should be fairly easy to extend to any number of cells.

#### Emissary Mappings

There are 3 mappings used: two mapping blocks for each of the "cells" (echo server backends), and a default fallback which is necessary for the header redirection to work.
Each cell has a header value associated with it for emissary to match. Since mapping evaluation/matching is done after authentication, we can use emissary's header matching to forward to a cell based on a header copied over from the auth service. The caveat is that all requests coming in must match a valid mapping *on entry* for emissary to process the reqeust, which is what the default mapping is for. The default mapping does not have to route to anything particular, the configuration in this POC is to provide visibility into which mapping is being used.


## Running the full system

### Minikube setup

**Note:** Using the hyperkit driver may not be necessary, but the working setup was tested this way
```sh
minikube start --namespace=emissary --vm-driver=hyperkit
```

### Get Emissary installed

**Note:** Follow step 1 here: https://www.getambassador.io/docs/emissary/latest/tutorials/getting-started/#1-installation
This is a copy of those steps at time of writing
```sh
kubectl create namespace emissary && \
kubectl apply -f https://app.getambassador.io/yaml/emissary/3.1.0/emissary-crds.yaml
kubectl wait --timeout=90s --for=condition=available deployment emissary-apiext -n emissary-system

helm install emissary-ingress --namespace emissary datawire/emissary-ingress && \
kubectl -n emissary wait --for condition=available --timeout=90s deploy -lapp.kubernetes.io/instance=emissary-ingress
```

### Build the auth service
This builds the image so its available to the minikube cluster
**Note:** If you need to update the code while it is already deployed, use version tags

```sh
eval $(minikube docker-env)
docker build . -t local-auth-service:latest
```

### Deploy services and configuration
```sh
kubectl create namespace cells
kubectl apply -f listener-http.yaml
kubectl apply -f example-echo-server.yaml
kubectl apply -f example-auth-service.yaml
kubectl apply -f example-auth-service-config.yaml
kubectl apply -f echo-mappings.yaml
```

### Make some requests

Using **`httpie`**:
```sh
export ECHO_URL="$(minikube service emissary-ingress -n emissary --url | head -n1)"
http -vv "$ECHO_URL/echo/" 'Host: bar.ada.support'
http -vv "$ECHO_URL/echo/" 'Host: foo.ada.support'
http -vv "$ECHO_URL/echo/" 'Host: asdf.ada.support'
```

Using **`curl`**:
```sh
export ECHO_URL="$(minikube service emissary-ingress -n emissary --url | head -n1)"
curl -i "$ECHO_URL/echo/" -H 'Host: bar.ada.support'
curl -i "$ECHO_URL/echo/" -H 'Host: foo.ada.support'
curl -i "$ECHO_URL/echo/" -H 'Host: asdf.ada.support'
```

Look for `header.x-cell-choice` and `os.hostname` in the output JSON to validate the forwarding config.
