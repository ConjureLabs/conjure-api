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

dnsmasq needs some extra config. It allows you to use any `.test` domain (`conjure.test`, `abc.view.conjure.test`, etc), which is needed for viewing running containers.

See [this guide](https://passingcuriosity.com/2013/dnsmasq-dev-osx/) for instructions (but replace `dev` with `test`, since Chrome now hijacks the `.dev` domain).

###### ngrok

GitHub needs public URLs. You can use ngrok to make your localhost public.

1. download ngrok
2. place ngrok executable at `~/ngrok`
3. run `~/ngrok http conjure.test:2999`
4. copy the forwarded (non-https) domain name (without the protocol) into `.profile`
5. keep ngrok running while you develop
6. restart the app

#### Fresh server setup

Must be an Ubuntu EC2

When done, add it to a LB

1. `ssh-keygen` _(do not do this on your local...)_
2. save public key as a deploy key on repo, on github
3. `git clone git@github.com:ConjureLabs/conjure-api.git`
4. `sudo apt update`
5. `curl -sL https://deb.nodesource.com/setup_10.x | sudo bash -`
6. `sudo apt-get install -y nodejs`
7. `sudo -E npm i -g yarn`
8. `sudo -E npm i -g pm2`
9. `sudo chown -R $USER:$(id -gn $USER) /home/ubuntu/.config `
10. in proj dir, save `.hob/.env` (make sure `NODE_PATH` is set to the right dir)
11. in proj dir, `yarn install`
12. in proj dir, `pm2 start ./bash/pm2/conjure-api.sh --name "conjure-api"`
