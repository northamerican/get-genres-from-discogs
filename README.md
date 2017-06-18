# Get genres from discogs
JS (JXA) script that fetches genres for iTunes tracks by scraping discogs.com.
Runs on recent versions of OS X.

## Usage
- In iTunes, select the tracks you wish to tag
- Run the .scpt file from Script Editor or use the compiled .app

A log will be created on your desktop with the results.

## About
This is still 'beta' and refinements need to be made regarding accuracy, handling of compilations, etc...
It is written in JXA, essentially Javascript for mac apps - made to function as an alternative to AppleScript.  
For info on this check out:  
Apple's [Javascript for Automation Notes](https://developer.apple.com/library/mac/releasenotes/InterapplicationCommunication/RN-JavaScriptForAutomation/)
dtinths's [JXA Cookbook](https://github.com/dtinth/JXA-Cookbook)

## To do

- Handle compilations better. Multiple artists in an album or ✔︎Compilation must exclude artist from search, or use album artist. 

- If album artist fails, try with artist tag
- Check for genres and styles listed on an album's `/release` pages

- Diffquotient function must be improved.  
ex: The Bug - Can't Take This No More  
does not match: Bug, The - Can't Take This No More / Rise Up

- Support concurrent tagging of two separate albums with the same name
- Create iTunes playlists for each found genre
- Option to add other albums by same artist in genre-specific playlist
- Make script self-check for updates via compluter.com
- Tagging fallback to wikipedia, last.fm, bandcamp, musicbrainz etc.
- Get record label name feature


![](http://i.imgur.com/SN4ngMs.png?)

