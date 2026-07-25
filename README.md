# Chrysalis
A Cross Platform Music Player with the main selling point of data organization, and extremely dynamic metadata and settings (I'll do my best to make ok windows and mac integration, but this is built *on* linux *for* linux)

## Testing it yourself
Because this is an alpha project i don't feel the need to compile it yet, so if you want to try it out yourself you have to do a few things.
### Setup
- Install Node.js ([`npm`](https://.com/npm/cli) 10.9.8 and [`node`](https://nodejs.org/) 22.22.3)
- Run

  ```
  git clone https://github.com/NicholasJDi/Chrysalis
  ```
- Open the `Chrysalis` folder in VSCode (or your preferred code editor idk)
- Open the Terminal with ctrl + \`
- Run
  
  ```
  npm install
  ```
- Create the directory `src/resources/bin`
- Obtain the [`mpv`](https://mpv.io/installation) program file (for linux mint just do
  
  ```
  sudo apt install mpv
  ```
  and copy the file from `/usr/bin/mpv`, it may be similar for other linux distros)
- Place the `mpv` program file in `src/resources/bin` and rename it to `Chrysalis` (or `Chrysalis.exe` for windows, you may also need to place dll's alongside it idk i don't own a windows machine)

### Usage
Chrysalis is currently a fully command line music player with no state saving, if you restart it anything you were doing will be lost.<br>
(this assumes you are running these commands from the vscode terminal)


Start Chrysalis with

```
npm start
```
and open a second terminal tab with ctrl + shift + \`


To view the commands Run

```
npm start help
```


To play a song Run

```
npm start open '<filepath>'
```
`<filepath>` has to be a full file path (starting with `/`) (you can also do Web Url's but its not recommended because mpv behaves kinda weirdly with them.)

```
npm start open https://soundcloud.com/sytricka/c418-stranger-things-remix-and-aria-math-mashup\
```


To add a song to the Playlist without playing it immediately Run

```
npm start add <filepath>
```
to remove a song from the Playlist run

```
npm start remove <filepath>
```


To view the songs currently in the Playlist Run

```
npm start list
```


To set Chrysalises volume Run

```
npm start volume <0-100>
```


To play or pause the current song Run

```
npm start play-pause
```


Skip to the next song in the Playlist with

```
npm start next
```
 and to the previous song with
 
 ```
 npm start prev
```


Close Chrysalis with

```
npm start quit
```


Go to a specific time or seek with

```
npm start position <time>[+/-]
```
(include `+` or `-` to seek by `<time>` forwards or backwards respectively)


Change how the player loops the Playlist with

```
npm start loop <type>
```
(None, Playlist, Track)


Shuffle the playlist with

```
npm start shuffle On
```
or unshuffle with

```
npm start shuffle Off
```

# Customizable, Rich, Supplemental Information Metadata (CRSIM)
I decided that `mpris:` and `xesam:` was not enough metadata for me, so I've come up with `crsim:`. (an alternate name for `crsim` is ChRisalIs Metadata)

`crsim` is a Separate Ontology for Supplemental Information Metadata that programs can read from alongside `xesam` and `mpris`, `crsim` is Customizable in the way that anyone can add tags to it as long as they follow some rules.

`crsim` is Object based, this means that it is much more rich than `xesam`.
`crsim` itself is a Object, you can view an Example JSON [here](https://github.com/NicholasJDi/Chrysalis/blob/main/CRSIM_Example.json).

`crsim` flattens Objects into Namespace Strings, (`crsim:title` `crsim:art.album` `crsim:art.override`)<br>
flattens Arrays into JSON Strings, (`crsim:artists = '["artist1","artist2"]'`)<br>
and converts all other Values into Strings. (excluding the Values in Arrays)

All keys beginning with `_` are reserved by `crsim` for internal usage, no program is allowed to make `crsim` keys that start with `_`.

Tags not in the base `crsim` Standard must be within a Namespace (Object), like `crsim:game.*`. (which would give information on game ost's)
