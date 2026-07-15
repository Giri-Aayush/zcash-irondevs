# Frequently Asking Questions

I'll collect here common questions related to the contest, if you don't find what you need,
feel free to [open an issue](https://github.com/jenkin/zcash-irondevs/issues/new).

## Can I request access to the CodeZ full archive?

No. CodeZ is hosted on a home server and publicly exposed through tailscale, no one can have direct access to the disk.
The full archive takes up to 20GB and it's updated daily, so I'll not make a snapshot available.

## Can I use CodeZ API to harvest data?

No. CodeZ is a public [Gitea](https://about.gitea.com/) instance powered by limited resources and the goal proposed by this contest requires the processing of the entire git history of hundreds of repositories. My suggestion is to develop projects against a small archive locally cloned, then I'll run it against the full archive using my own resources.
