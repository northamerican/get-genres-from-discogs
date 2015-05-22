var iTunes = Application('iTunes');
var app = Application.currentApplication();

iTunes.includeStandardAdditions = true;
app.includeStandardAdditions = true;

var version = '0.2015.05 beta';
var prefs = {
    // // Option to get all genres and styles
    // multiGenre: true,

    // Separate genres with this character
    genreSeparator: ', ',

    // Replace a discogs genre string with your own
    replaceGenres: {
        'Folk, World, & Country': 'Traditional',
        'RnB/Swing': 'R&B'
    },

    // Directory to store the log data
    history: '~/Library/Preferences/get-genres-from-discogs.json',

    // The title of the album on discogs must not be more dissimilar in % to the title in itunes
    matchThreshold: 35 //%
};
var output = {
    // Toggle logging
    logging: true,

    // Directory to store the human-readable log
    directory: 'Desktop',
    filename: 'Get Genres from Discogs.log',
    log: [
        ['Changes'],
        ['No changes made']
    ]
};

var curl = 'curl -H "User-Agent: Chrome/40" ';
var searchURL = 'http://www.discogs.com/search/?q=';
var discogsAPIURL = 'https://api.discogs.com';
var songs = iTunes.selection();

var albums = (function() {
    var albums = {};

    Object.keys(songs).forEach(function(song, i){
        var song = songs[i];
        var album = song.album();
        var artist = song.albumArtist() || song.artist();
        var albumArtist = song.albumArtist();

        albums[album] = {
            artist: artist,
            albumArtist: albumArtist
        };
    });

    return albums;
})();
var albumTitles = function() {
    var titles = Object.keys(albums);

    Progress.totalUnitCount = titles.length;

    return titles;
};


// Get the master page of an album
var getDiscogsPage = function(album) {
    var artist = albums[album].artist;
    var useMethod = 0;
    var searchMethods = [
        function() { // exact album and artist
            var url = searchURL +
                encodeURIComponent('"' + album + '" ' + artist) // Encode artist and album into URL
                .replace(/%20/g, '+') // Replace spaces with URL encoded +
                .replace(/[\(\)\']/g, '') // Remove characters that break cURL
            return url;
        },
        function() { // album and artist
            var url = searchURL +
                encodeURIComponent(album + ' ' + artist)
                .replace(/%20/g, '+')
                .replace(/[\(\)\']/g, '')
            return url;
        },
        function() { // album
            var url = searchURL +
                encodeURIComponent(album)
                .replace(/%20/g, '+')
                .replace(/[\(\)\']/g, '')
            return url;
        },
        function() { // album and artist brackets removed
            var url = searchURL +
                encodeURIComponent(album + ' ' + artist)
                .replace(/%20/g, '+')
                .replace(/[\(\[][^]+?[\)\]]/, '') // Remove anything in parentheses or brackets
                .replace(/[\(\)\']/g, '')
            return url;
        }
    ];
    var albumURL;

    // Try searching for the album using the methods above
    while (!albumURL && typeof searchMethods[useMethod] === 'function') {
        var page = app.doShellScript(curl + searchMethods[useMethod]());

        albumURL = page.match(/href="(.*\/(master|release)\/\d+?)"/);
        albumURL = albumURL ? albumURL[1] : null; // First search result
        useMethod++;
    }

    return albumURL;
}

// Get genres/styles for each album
var parseGenres = function() {
    albumTitles().forEach(function(albumTitle, i) {
        var masterPage = getDiscogsPage(albumTitle);

        Progress.completedUnitCount = i + 1;
        Progress.description = 'Processing album "' + albumTitle + '"';

        if(!masterPage) {
            albums[albumTitle].discogs = {
                title: false,
                artists: [],
                genres: [],
                match: false
            };

            return;
        }

        // Get the release's info using discog's API
        // master -> masters, release -> releases
        var pageAPI = discogsAPIURL +
        masterPage.match(/\/(release|master)\/.+/)[0]
        .replace('master', 'masters')
        .replace('release', 'releases');

        var discogsJSON = JSON.parse(app.doShellScript(curl + pageAPI));

        // Save info gathered from discogs's API
        albums[albumTitle].discogs = {
            title: discogsJSON.title,
            artists: discogsJSON.artists.map(function(artist) {
                return artist.name;
            }),
            genres: (function() {
                var genres = discogsJSON.genres;
                var styles = discogsJSON.styles || [];

                return genres.concat(styles);
            })(),
            match: (function() {
                return diffQuotient(albumTitle, discogsJSON.title) < prefs.matchThreshold;
            })()
        }
    });
}
// Apply genres to iTunes tracks
var applyGenres = function() {
    var history = {};
    var createLog;

    parseGenres();

    // Get existing history
    try {
        history = app.doShellScript('cat ' + prefs.history);
    } catch(e) {
        // throw "couldn't fetch history";
        history = {};
    }

    try {
        history = JSON.parse(history.replace(/`/g, "'"));
    } catch(e) {
        // throw "couldn't parse history";
        history = {};
    }

    // Add albums to history
    Object.keys(albums).forEach(function(albumTitle) {
        var album = albums[albumTitle];
        var artist = album.artist;
        var historyTitle = artist + ' - ' + albumTitle;

        // Add to history object
        history[historyTitle] = album;
    });

    // Save history object
    app.doShellScript("echo '" + JSON.stringify(history, null, 4).replace(/\'/g, "`") + "' > " + prefs.history);


    // Set genres to iTunes tracks
    songs.forEach(function(song) {
        var album = albums[song.album()];
        var genres = album.discogs.genres;
        var isMatch = album.discogs.match;

        // User-specified genre replacement
        Object.keys(prefs.replaceGenres).forEach(function(genre) {
            var replacement = prefs.replaceGenres[genre];

            genres[genres.indexOf(genre)] = replacement;
        });

        if(genres.length && isMatch) {
            // Set genre of song
            song.genre = genres.join(prefs.genreSeparator);

            // // Add song to playlist for each genre
            // Still gotta figure out the syntax for this. JXA documentation is unclear...
            // genres.forEach(function(genre) {
            //     iTunes.make({
            //         new: 'playlist',
            //         withProperties: {
            //             name: genre
            //         },
            //         // at: {
            //         //     folderPlaylist: 'history'
            //         // }
            //     });
            // });
        }
    });

    // Log
    Object.keys(history).forEach(function(albumTitle) {
        var album = history[albumTitle];
        var title = album.discogs.title;
        var artists = album.discogs.artists.join(', ');
        var genres = album.discogs.genres.join(', ');
        var isMatch = album.discogs.match;

        if(genres.length && isMatch) {
            output.log[0].push(albumTitle + '\n' + 'from: ' + artists + ' - ' + title + '\n' + genres + '\n');
        } else if (genres.length && !isMatch) { //"!isMatch" redundant
            output.log[1].push(albumTitle + '\n' + 'did not match: ' + artists + ' - ' + title + '\n');
        } else {
            output.log[1].push(albumTitle + '\n');
        }
    });

    // Save log
    if(output.logging) {
        output.log = output.log.map(function(log) {
            return log.join('\n');
        });

        createLog = 'echo ' + JSON.stringify(output.log.join('\n\n\n\n')) +
        ' > ~/' + output.directory + '/' + output.filename.replace(/\s/g, '\\ ')

        app.doShellScript(createLog);
    }

    return albums;
}

// Compare the difference of the supplied album title and the title on discogs
// to determine if they are the same album.
function diffQuotient(a, b) {
    //http://jsperf.com/levenshtein-algorithms/16
    var levDist = function(a, b) {
        if (a == b) return 0;
        var aLen = a.length, bLen = b.length;
        if (!aLen) return bLen;
        if (!bLen) return aLen;
        var len = aLen + 1,
            v0 = new Array(len),
            v1 = new Array(len),
            c2, min, tmp,
            i = 0,
            j = 0;
        while(i < len) v0[i] = i++;
        while(j < bLen) {
            v1[0] = j + 1;
            c2 = b.charAt(j++);
            i = 0;
            while(i < aLen) {
                min = v0[i] - (a.charAt(i) == c2 ? 1 : 0);
                if (v1[i] < min) min = v1[i];
                if (v0[++i] < min) min = v0[i];
                v1[i] = min + 1;
            }
            tmp = v0; v0 = v1; v1 = tmp;
        }

        return v0[aLen];
    }
    var len = (a.length + b.length) / 2;
    var dist = levDist(a, b);

    return 100 / (len / dist);
}

applyGenres();

Progress.description = 'Processing albums...';


// To do

// Handle compilations: multiple artists or compilation bool means exclude artist from search

// If album artist fails, try with artist (Caustic Window / Aphex Twin)
// Some album have style only inside /release page (like Witch - Introduction)

// Diffquotient must be improved. ex:
// The Bug - Can't Take This No More
// did not match: Bug, The - Can't Take This No More / Rise Up

// Won't work with two albums with same name


// Bonus

// Create playlists for each genre
// Option to add other albums by same artist in genre-specific playlist
// Check for updates on compluter.com

// fallback to wikipedia
// fallback to last.fm
// fallback to bandcamp, what.cd, ... and compare with genre list on discog's wiki,
// using discog's formatting/wording (for consistency)

// Get record label
