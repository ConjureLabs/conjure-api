<p align="center">
  <kbd>a p i</kbd>
</p>

# Conjure API

Conjure API client

#### Local Development

##### Dependencies

1. ngrok
2. dnsmasq (`brew install dnsmasq`)
3. `yarn install`

###### Dnsmasq

dnsmasq needs some extra config. It allows you to use any `.local` domain (`conjure.local`, `abc.view.conjure.local`, etc), which is needed for viewing running containers.

See [this guide](https://passingcuriosity.com/2013/dnsmasq-dev-osx/) for instructions (but replace `dev` with `local`, since Chrome now hijacks the `.dev` domain).

###### ngrok

GitHub needs public URLs. You can use ngrok to make your localhost public.

1. download ngrok
2. place ngrok executable at `~/ngrok`
3. run `~/ngrok http conjure.local:2999`
4. copy the forwarded (non-https) domain name (without the protocol) into `.profile`
5. keep ngrok running while you develop
6. restart the app
