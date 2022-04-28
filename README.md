# Visualising Singapore's Longest Bus Routes

### What is this:

A data story about Singapore's transport policy through the lens of Singapore's longest bus routes, accompanied with an interactive visualisation of bus services in Singapore.

### How this was made:

Website made from scratch with d3.js and a dash of other people's code. 

The data on bus stops and bus lines sourced from LTA DataMall API. A local Python script (not in this repo) pulled them and processed them into a format that's more easily iterable by d3.js. The reason for this is to ease processing time: it felt weird to ping the API and do all of the reprocessing in JavaScript when the page loads, especially when the data is mostly static. 

Bus line data comes in the form of a string of bus stop locations. Bus lines were drawn by interpolating a series of GeoJSON LineStrings between each stop. Some lines will have weird straight lines for this reason - bus lines travelling along highways won't have the highway path data stored. 

### From ideation to execution:

Originally this was a project to visualise live bus locations upon request. But LTA DataMall doesn't give you bus locations easily - the best you can do is ping a bus stop and see where the next 2-3 buses are. There's no easy way to tag a particular bus on a particular line so its location can be tweened over time.

Because you have to ping every bus stop on a line to find the relevant buses, it takes a lot of API pings to construct a snapshot of a bus line at a particular time - let alone a live visualisation!

However, as I was exploring long bus lines to 'record' to visualise, it struck me as interesting how many long bus lines there were. Exploring the distribution of bus line lengths led me to think about my experiences with long bus lines, and recent news items about the cancellation of long bus lines.

This website was the result of turning these thoughts into a data story. The text follows recent transport policy history on long bus routes, while the interactive charts and maps show information about those routes. The data allows these transport debates to be contextualised, as well as lend a personal stake to the issues discussed (you can search where your favourite bus lines go!).

### Todo:

- Turn the static maps into zoomable/pannable (and hopefully, very minimalist) Leaflet widgets.
- Render the relevant bus stops when you search for bus lines.
- Encode more info into the bus stop map using interactivity.
- Clean up the code (abstracting update functions, cleaning up or standardising overly_specific_variable_names).
