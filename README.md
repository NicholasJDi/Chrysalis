# Chrysalis
A Music Player with the main selling point of data organization, and extremely dynamic metadata and settings, for now this is a Linux only project (i chose electron for the single purpose of cross platform compatibility, at some point i will do so but for being in such early stages of development i would like to work on only what i can test.)

> [!IMPORTANT]
> This is a Passion Project and it is in a Very VERY early state, i would honestly not recommend even attempting to use this in any way.

## Testing it yourself
Because this is an alpha project i don't feel the need to compile it yet, so if you want to try it out yourself you have to do a few things.
### Setup
- Install Node.js ([`npm`](https://.com/npm/cli) 12.0.2 and [`node`](https://nodejs.org/) 22.22.3)
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
- Place the `mpv` program file in `src/resources/bin` and rename it to `Chrysalis`

### Usage
Chrysalis is currently a fully command line music player.<br>
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


To add a song to the Playlist (or play if it's already in the Playlist) Run

```
npm start open '<filepath>'
```
`<filepath>` has to be a full file path (starting with `/`) (you can also do Web Url's but its not recommended because mpv behaves kinda weirdly with them.)

```
npm start open https://soundcloud.com/sytricka/c418-stranger-things-remix-and-aria-math-mashup/
```

to remove a song from the Playlist run

```
npm start close <filepath>
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
npm start position <time> [+/-]
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

Metadata must be defined manually and are stored as .crsim (JSON) files at ~/chrysalis/metadata

## Metadata
Chrysalis uses MPRIS with the [CRSim](https://github.com/NicholasJDi/CRSIM) ontology to expose and store metadata, because [CRSim](https://github.com/NicholasJDi/CRSIM) handles a LOT more than xesam or other, Chrysalis is (as far as i know) the first music player to have ridiculously extensive metadata.

## The Future
- For now i will continue to develop Chrysalis with electron, but at some point i would kind of like to recode it in rust (simply because i think it would be funny)
- I will make Chrysalis Cross Platform at some point
