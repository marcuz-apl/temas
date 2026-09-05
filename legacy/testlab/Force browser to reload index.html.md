# Force browser to reload index.html

### Question

How can I force a browser to always load the newest version of index.htm when the page is loaded by entering the URL www.mydomain.com/index.htm or just www.mydomain.com in the browser's address field and pressing enter.

I'm trying this in Chrome and the newest version of index.htm is apparently only loaded, when I refresh manually (F5), or when the URL is already in the browser's address field and I press enter.

I guess I am doing something extremely stupid, because when I searched for the issue, all I could find were solutions about how to make a browser reload your .js and .css files by appending ?v=xxxx to the file names. But how should this work, if not even the newest version of index.html page, in which I am doing these modifications, is loaded??

I also tried putting

```html
<meta http-equiv="cache-control" content="no-cache">
```

in the `<head>` of index.html. But this does not seem to have any effect.

Any help would be greatly appreciated!

Thanks, Linus

### Answer

OK, apparently no-cache was not enough. The following does the trick:

```html
  <meta http-equiv="cache-control" content="no-cache, must-revalidate, post-check=0, pre-check=0" />
  <meta http-equiv="cache-control" content="max-age=0" />
  <meta http-equiv="expires" content="0" />
  <meta http-equiv="expires" content="Tue, 01 Jan 1980 1:00:00 GMT" />
  <meta http-equiv="pragma" content="no-cache" />
```

Another Answer:

You can use the code below to refresh or reload the currently loaded index page from a URL address entered directly into the browser's address bar, after a specific number of seconds, thereby forcing the browser to always reload the current document. In this case, the number of seconds has been set to 5:

```html
<meta http-equiv="refresh" content="5" />
```

Please note that setting the number of seconds to 0 will cause the page to be automatically reloaded instantly, every time it is successfully downloaded.