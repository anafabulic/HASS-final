
// Define dimensions
let w = 1000, h = 600, gutter = 20;

// Define helper functions

// 1. Ordinal generator
let ordinal = (number) => {
    let ordinalRules = new Intl.PluralRules("en", {
        type: "ordinal"
    });
    let suffixes = {
        one: "st",
        two: "nd",
        few: "rd",
        other: "th"
    };
    let suffix = suffixes[ordinalRules.select(number)];
    return (number + suffix);
}
// 2. Mean calculator
let mean = (array) => {
    let total = 0;
    let count = 0;
    array.forEach(function(item) {
        total += item;
        count++;
    });
    return total / count;
}
// 3. Median calculator
let median = (values) => {
    if(values.length ===0) throw new Error("No inputs");
    values.sort((a,b) => {
        return a - b;
    });
    let half = Math.floor(values.length / 2);
    if (values.length % 2)
        return values[half];
return (values[half - 1] + values[half]) / 2.0;
}

// Define d3 selections
let svg_ab = d3.select("svg#all_buses")
.attr("viewBox", `0 0 ${w} ${h}`);
let svg_rl = d3.select("svg#route_lengths")
.attr("viewBox", `0 0 ${w} ${h}`);
let svg_ls = d3.select("svg#longest_shortest")
.attr("viewBox", `0 0 ${w} ${h}`);
let svg_hs = d3.select("svg#histogram")
.attr("viewBox", `0 0 ${w} ${h}`);

// Define URIs
let data_uri = "https://raw.githubusercontent.com/anafabulic/HASS-final/main/json/service_summary.json";
let basemap_uri = "https://raw.githubusercontent.com/anafabulic/HASS-final/main/json/sg_plnarea_simple.geojson";
let stop_coords_uri = "https://raw.githubusercontent.com/anafabulic/HASS-final/main/json/stop_coords.json";
let stop_counts_uri = "https://raw.githubusercontent.com/anafabulic/HASS-final/main/json/stop_counts.json";

Promise.all(
[   d3.json(data_uri),
    d3.json(basemap_uri),
    d3.json(stop_coords_uri),
    d3.json(stop_counts_uri)   ]).then(data => {

    // Define variables/objects; rewind data[0] as basemap
    let routes = data[0];
    let basemap = data[1];
    let basemap_r = basemap.features;
    for (let i = 0; i < basemap_r.length; i++) {
        if (basemap_r[i].geometry.type == "MultiPolygon") {
            for (let j = 0; j < basemap_r[i].geometry.coordinates.length; j++) {
                basemap_r[i].geometry.coordinates[j][0].reverse();
            }
        } else {
            basemap_r[i].geometry.coordinates[0].reverse();
        }
    }; 
    basemap.features = basemap_r;
    let stop_coords = data[2];
    let stop_counts = data[3];
    let ranges = {};

    console.log(basemap);
    console.log(routes);
    console.log(stop_coords);
    console.log(stop_counts);

    // 1. Drawing svg all_buses
        
    // Define d3 projection
    let projection = d3.geoMercator()
        .fitExtent(
            [
                [gutter, gutter],
                [w - gutter, h - gutter]
            ],
            basemap
        );
    let geopath = d3.geoPath().projection(projection);

    // Draw map
    svg_ab.append("g")
        .attr("class", "basemap")
        .selectAll("path")
        .data(basemap.features)
        .enter()
        .append("path")
        .attr("d", geopath);

    // Build + clean stop data 
    let stops = [];
    Object.entries(stop_coords).forEach(function(item) {
        stops.push(
            {
                "stop":      item[0],
                "latitude":  item[1][0],
                "longitude": item[1][1],
                "count":     stop_counts[item[0]]
            }
        );
    });
    stops.sort((a,b) => {
        return a.count - b.count;
    });

    // Calculate min and max stopcounts
    ranges.svg_ab = [1e6, 0] // [min, max]
    stops.forEach(function(item) {
        if (item.count < ranges.svg_ab[0]) {
            ranges.svg_ab[0] = item.count;
        }
        if (item.count > ranges.svg_ab[1]) {
            ranges.svg_ab[1] = item.count;
        }
    });

    // Construct colorscale, radius scale, etc.
    let cs_svg_ab = d3.scaleSequential()
        .domain(ranges.svg_ab)
        .range([0.95,0.05]); // not pegging [1,0] because if you're setting other attributes by d.count you want a reasonable nonzero somewhere.
    function cs_svg_r_maker(float) {
        let r = 6.5;
        return ((1 - cs_svg_ab(float))*r) + 1
    };

    // Draw the stops
    // TODO: slider that filters most-used stops from lesser-used stops?
    //       or a button that changes the view to hexbin/counts?
    // see : https://observablehq.com/@mbostock/walmarts-growth 
    svg_ab.append("g")
        .selectAll("circle")
        .data(stops)
        .join(
            function(enter) {
                return enter
                    .append("circle")
                    .attr("class", "svg_ab_pts")
                    .attr("cx", d => projection([d.longitude, d.latitude])[0] )
                    .attr("cy", d => projection([d.longitude, d.latitude])[1] )
                    .attr("id", d => d.stop)
                    .attr("r", "0.01px")
                    // .attr("fill-opacity", d => (1 - cs_svg_ab(d.count)))
            }
        )
        .transition()
        .delay(d => (1 - cs_svg_ab(d.count))*1250) // fancy fade-in based on d.count
        .duration(750)
        .attr("r", d => cs_svg_r_maker(d.count) + "px")
        .attr("fill-opacity", "0.85")
        .attr("fill", d => d3.interpolateInferno(cs_svg_ab(d.count)));

    // Get legend keys from ranges.svg_ab
    function svg_ab_getlgd(min, max, lvls) {
        keys = [];
        for(i = 0; i < (lvls-1); i++) {
            keys.push({
                value: Math.round((max - ((max-min)*i/(lvls-1)))/10)*10,
                ord: i + 1
            });
            // rounds each legend value (up or down) to nearest 10 
        }
        keys.push({
            value: min + 1,
            ord: lvls
        })
        return keys;
    }

    // Draw legend

    let svg_ab_lgd = svg_ab.append("g")
        .attr("class", "svg_ab_lgd")
        .attr("transform", "translate(" + (w * 0.80) + "," + (h * 0.60) + ")" )
    
    svg_ab_lgd.append("rect")
        .attr("x", "-10")
        .attr("y", "5")
        .attr("height", (0.28*h))
        .attr("width", "160")
        .attr("fill", "var(--bg1)")
        .attr("fill-opacity", "0.7");
    svg_ab_lgd.append("rect")
        .attr("x", "-12")
        .attr("y", "5")
        .attr("height", (0.28*h))
        .attr("width", "25")
        .attr("fill", "var(--bg3)")
        .attr("fill-opacity", "0.7");

    svg_ab_lgd.selectAll("circle")
        .data(svg_ab_getlgd(ranges.svg_ab[0], ranges.svg_ab[1], 5))
        .join(
            function(enter) {
                return enter
                    .append("circle")
                    .attr("class", "svg_ab_pts")
                    .attr("transform",d => `translate(0, ${d.ord*30})`)
                    .attr("r", "0.01px");
            }
        )
        .transition()
        .duration(750)
        .attr("r", d => cs_svg_r_maker(d.value) + "px")
        .attr("fill-opacity", "0.85")
        .attr("fill", d => d3.interpolateInferno(cs_svg_ab(d.value)));

    d3.select(".svg_ab_lgd")
        .selectAll("text")
        .data(svg_ab_getlgd(ranges.svg_ab[0], ranges.svg_ab[1], 5))
        .join(
            function(enter) {
                return enter
                    .append("text")
                    .attr("class", "axis_text")
                    .attr("transform",d => `translate(${w * 0.02}, ${d.ord*30 + (h * 0.007)})`)
                    .text(d => {
                        if (d.value < 10) {
                            return `\u2000${d.value.toString()} bus routes`
                        } else {
                            return `${d.value.toString()} bus routes`
                        };
                    });
            }
        )

    // 2. Drawing svg longest_shortest

    // Draw basemap
    svg_ls.append("g")
        .attr("class", "basemap")
        .selectAll("path")
        .data(basemap.features)
        .enter()
        .append("path")
        .attr("d", geopath);

    // Input box
    d3.select("form.svg_ls_input")
        .append("input")
        .attr("type", "text")
        .attr("size", "30px")
        .attr("list", "stops")
        .attr("name", "ls_input")
        .attr("id", "ls_input")
        .attr("placeholder", "\u2000(e.g. NR8, 33, 162M)\u2000");
    let route_list = routes.map(({route}) => {return route});

    // rudimentary autocomplete as 'datalist' - works on desktop and some mobiles
    d3.select("form.svg_ls_input")
        .append("datalist")
        .attr("id", "stops")
        .selectAll("option")
        .data(route_list)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => d);

    // Populate route data .
    let svg_ls_data = [];
    // Very hacky interlude to populate max_km_ordinal data while list is sorted by most stops
    routes.sort((a,b) => {
        return b["max_km"] - a["max_km"];
    });
    routes.forEach(function(item, index) {
        item.max_km_ordinal = index + 1;
    });
    routes.sort((a,b) => {
        return b["length"] - a["length"];
    });
    routes.forEach(function(item, index) {
        // Create a geoJSON linestring between consecutive bus stops, then append all linestrings to a single 'links' dataset
        let stoplist = item.stops; 
        let links = [];
        for (var i=0, len=stoplist.length-1; i<len; i++) {
            links.push({
                type: "LineString",
                coordinates: [
                    [stoplist[i].longitude, stoplist[i].latitude],
                    [stoplist[i+1].longitude, stoplist[i+1].latitude]        
                ]
            });
        };
        svg_ls_data.push({
            route_no: item.route,
            route: links,
            length: item.length,
            max_km: item.max_km,
            max_km_ordinal: item.max_km_ordinal,
            ordinal: index + 1
        });  
    });
    let svg_ls_g = svg_ls.append("g")
            .attr("id", "svg_ls_routes");

    // Draw the links
    function update_ls(data, d3_selection, render_time, classname) {
        data.forEach(function(item) {
            d3_selection.selectAll("path")
                .data(item.route)
                .join(
                    function(enter) {
                        return enter
                            .append("path")
                            .attr("class", classname)
                            .attr("stroke-opacity", "0.01");
                    },
                    function(update) {
                        return update
                            .transition()
                            .duration(render_time*0.75)
                            .attr("stroke-opacity", "0.01");
                    },
                    function(exit) {
                        return exit
                            .transition()
                            .duration(render_time*0.75)
                            .attr("stroke-opacity", "0.01")
                            .on("end", function() {
                                d3.select(this).remove();
                            });
                    }
                )
                .transition()
                .duration(render_time*1.00)
                .attr("stroke-opacity", "0.75")
                .attr("d",geopath);
        });
    };

    let svg_ls_text = svg_ls.append("g")
        .attr("class", "svg_ls_text");

    function update_ls_text(data) {
        // Add pointer to label
        svg_ls_text.selectAll("path")
            .data(data)
            .join(
                function(enter) {
                    return enter
                        .append("path")
                        .attr("class", "svg_ls_ptr")
                        .attr("stroke-opacity", "0.75");
                },
                function(update) {
                    return update;
                },
                function(exit) {
                    return exit.remove();
                }
            )
            .attr("d", d => 
                "M" + projection(d.route[0].coordinates[0])[0] +
                "," + projection(d.route[0].coordinates[0])[1] +
                "L" + "730" +
                "," + "510"
            );
        
        // Hack to 'buffer' the label
        svg_ls_text.selectAll("rect")
            .data(data)
            .join(
                function(enter) {
                    return enter
                        .append("rect")
                        .attr("x", "700")
                        .attr("y", "490")
                        .attr("width", "100px")
                        .attr("height", "100px")
                        .attr("fill", "var(--bg0)")
                        .attr("transform", "translate(-15, -30)");
                }
            );

        // Add label
        svg_ls_text.selectAll("text").remove();
        let textspace = svg_ls_text.selectAll("text")
            .data(data)
            .join(
                function(enter) {
                    return enter
                        .append("text")
                        .attr("class", data.route_no)
                        .attr("style","font-family:'Inconsolata';")
                        .attr("transform", "translate(700,490)");
                },
                function(exit) {
                    return exit.remove();
                }
            );
        
        textspace.text(d => "Bus " + d.route_no)
            .attr("dy","0")
            .attr("font-size", "1.9em")
            .attr("transform", "translate(700,490)");
        
        textspace.append("tspan")
            .attr("dy", "1.5em")
            .attr("x", 0)
            .attr("font-size", "0.6em")
            .text(d => d.length + " stops (" + ordinal(d.ordinal) + "-longest)");

        textspace.append("tspan")
            .attr("dy", "1.5em")
            .attr("x", "0")
            .attr("font-size", "0.6em")
            .text(d => d.max_km + " km (" + ordinal(d.max_km_ordinal) + "-longest)");
        
    };

    // Set initial values
    let initialValue = "51";
    let filteredArray = svg_ls_data.filter(item => item.route_no === `${initialValue}`);
    update_ls(filteredArray, svg_ls_g, 1000, "svg_ls_g_ln");
    update_ls_text(filteredArray);

    // Listen to the input box
    d3.select("#ls_input").on("input", function(d) {
        let selectedValue = this.value.toUpperCase();
        let filteredArray = svg_ls_data.filter(item => item.route_no === `${selectedValue}`);
        // Hacky update trick: update_ls_text exits nicely on empty array, but update_ls panics if there are no elements in route[].
        // Hence: do update_ls_text, then populate route if filteredArray is empty, then do update_ls.
        update_ls_text(filteredArray);
        if (filteredArray.length == 0) {
            filteredArray.push({
                route_no: null,
                route: [{}],
                length: null,
                max_km: null,
                max_km_ordinal: null,
                ordinal: null
            });
        };
        update_ls(filteredArray, svg_ls_g, 1000, "svg_ls_g_ln");
    });

    // The long, straight lines crossing the island are normal. They represent cross-island services with very large distances between stops.

    // 3. Drawing svg route_lengths (bar charts of route lengths)

    // Define min/max      
    ranges.svg_rl = {}  
    ranges.svg_rl.length = [1e6, 0]; // min, max
    routes.forEach(function(item) {
        if (item.length < ranges.svg_rl.length[0]) {
            ranges.svg_rl.length[0] = item.length;
        };
        if (item.length > ranges.svg_rl.length[1]) {
            ranges.svg_rl.length[1] = item.length;
        };
    });
    ranges.svg_rl.max_km = [1e6, 0]; // min, max
    routes.forEach(function(item) {
        if (item.max_km < ranges.svg_rl.max_km[0]) {
            ranges.svg_rl.max_km[0] = item.max_km;
        };
        if (item.max_km > ranges.svg_rl.max_km[1]) {
            ranges.svg_rl.max_km[1] = item.max_km;
        };
    });

    // Initialise some important cosmetic variables
    let svg_rl_viewlimit = 50; // Limit at which y-axis text stops being visible
    let svg_rl_viewlimit2 = 100; // Limit at which lollipops become bars
    let svg_rl_init = 25; // Initialise zoom level at this value

    // Define selections to render on
    let svg_rl_bc = svg_rl.append("g")
        .attr("id", "svg_rl_chart")
        .attr("transform", "translate(100,40)");
    let svg_rl_bars = svg_rl_bc.append("g")
        .attr("class", "svg_rl_bars");
    let svg_rl_interaction = svg_rl_bc.append("g")
        .attr("class", "svg_rl_interaction");
    let svg_rl_x = svg_rl_bc.append("g")
        .attr("class", "axis_text svg_rl_x");
    let svg_rl_x2 = svg_rl_bc.append("g")
        .attr("class", "axis_text svg_rl_x2");
    let svg_rl_y = svg_rl_bc.append("g")
        .attr("class", "axis_text svg_rl_y");
    let svg_rl_x_lab = svg_rl_bc.append("text")
        .attr("class", "axis_text")
        .attr("x", w*0.825)
        .attr("y", -h*0.02);
    let svg_rl_inset = svg_rl_bc.append("svg")
        .attr("style", "overflow:visible;")
        .attr("x", w*0.45)
        .attr("y", h*0.50)
        .attr("width", w*0.50)
        .attr("height", h*0.35)
        .attr("viewBox", "0 0 " + w + " " + h);
    let svg_rl_inset_basemap = svg_rl_inset.append("g")
        .attr("class", "basemap inset");
    
    // Add inset map
    svg_rl_inset_basemap.selectAll("path")
        .data(basemap.features)
        .enter()
        .append("path")
        .attr("d", geopath)
        .attr("opacity", 0); // start transparent
    let svg_rl_g = svg_rl_inset.append("g")
        .attr("class", "svg_rl_g"); // to append busroutes on mouseover of lollipops
    let svg_rl_inset_text = svg_rl_inset.append("g")
        .attr("class", "svg_rl_inset_text");
    
    // Append sliders
    d3.select("div.svg_rl_slider")
        .append("input")
        .attr("type", "range")
        .attr("min", "0")
        .attr("max", "100")
        .attr("value", svg_rl_init)
        .attr("name", "rl_slider")
        .attr("id", "rl_slider")
        .attr("class", "slider");
    d3.select("div.svg_rl_scroller")
        .append("input")
        .attr("type", "range")
        .attr("min", "0")
        .attr("max", "100")
        .attr("value", "100")
        .attr("orient", "vertical")
        .attr("name", "rl_scroller")
        .attr("id", "rl_scroller")
        .attr("class", "scroller");
    // makes the scrollbar responsive - don't ask
    let rl_scroll_resize = d => d3.select("input#rl_scroller")
        .attr(
            "style", `
                height:${document.getElementById("route_lengths").clientHeight*0.9}px;
                margin-top: ${document.getElementById("route_lengths").clientHeight*0.05}px;
            `
        )
    rl_scroll_resize();
    d3.select(window).on('resize', rl_scroll_resize);
    
    // Append dropdown selector
    let svg_rl_dropdown_form = d3.select("div.svg_rl_dropdown")
        .append("form");
    svg_rl_dropdown_form.append("label")
        .attr("for", "rl_dropdown");
    let svg_rl_dropdown_form_select = svg_rl_dropdown_form.append("select")
        .attr("class", "dropdown")
        .attr("name", "rl_dropdown")
        .attr("id", "rl_dropdown");
    svg_rl_dropdown_form_select.append("option")
        .attr("value", "max_km")
        .text("View routes by length (km)");
    svg_rl_dropdown_form_select.append("option")
        .attr("value", "length")
        .text("View routes by number of stops");

    function update_rl(data, slice, scroll, factor, ms) {
        // Sort and slice
        data.sort((a,b) => {
            return b[factor] - a[factor];
        });
        let start = Math.round(scroll/100*(data.length-slice));
        let working_data = data.slice(start, Math.round(start+slice));

        // Define arrays for drawing y_scale and map inset
        let y_scale_list = working_data.map(({route}) => {return route});
        svg_rl_inset_data = [];
        working_data.forEach(function(item, index) {
            // Create a geoJSON linestring between consecutive bus stops, then append all linestrings to a single 'links' dataset
            let stoplist = item.stops; 
            let links = [];
            for (var i=0, len=stoplist.length-1; i<len; i++) {
                links.push({
                    type: "LineString",
                    coordinates: [
                        [stoplist[i].longitude, stoplist[i].latitude],
                        [stoplist[i+1].longitude, stoplist[i+1].latitude]        
                    ]
                });
            };
            svg_rl_inset_data.push({
                route_no: item.route,
                route: links,
                length: item.length,
                max_km: item.max_km,
            });  
        });

        // Define scales and axes
        let x_scale = d3.scaleLinear()
            .domain([0, ranges.svg_rl[factor][1]*1.05])
            .range([0, w * 0.80])
            .nice();
        let y_scale = d3.scaleBand()
            .domain(y_scale_list)
            .range([0, h * 0.85])
            .paddingInner(0.05);
        svg_rl_bars.attr("transform", "translate(0," + y_scale.bandwidth()/2 + ")");

        // Setup axes
        svg_rl_x.transition()
            .duration(750)
            .call(d3.axisTop(x_scale))
            .attr("transform", "translate(0," + (h * -0.02) + ")");
        svg_rl_x2.transition()
            .duration(750)
            .call(d3.axisBottom(x_scale))
            .attr("transform", "translate(0," + (h * 0.88) + ")");
        svg_rl_y.transition()
            .duration(400) // snappier transition = illusion of control
            .call(d3.axisLeft(y_scale)
            .tickSizeInner(0));
        
        // Chart labels
        svg_rl_x_lab.text(d => {if (factor == "max_km") {return "km"} else {return "stops"}});
        svg_rl_x_lab.append("tspan")
            .attr("dy", -h*0.02)
            .attr("x", -w*0.02)
            .attr("text-anchor", "end")
            .attr("font-size", "0.8em")
            .text(`Showing`);
        svg_rl_x_lab.append("tspan")
            .attr("dy", "1.0em")
            .attr("x", -w*0.02)
            .attr("text-anchor", "end")
            .attr("font-size", "0.8em")
            .text(`#${start+1}\u2013${Math.round(start+slice)+1}`);
        // Remove y-axis labels if too crowded
        // Also hacked together a 'zoom-out' resize rule
        if (slice <= svg_rl_viewlimit) {
            d3.select(".svg_rl_y").attr("style", "font-size:" + ((1-(slice/svg_rl_viewlimit))*2.5) + "em;stroke-width:0px;font-family:'Inconsolata';");
        } else {
            d3.select(".svg_rl_y").attr("style", "font-size:0.0em;stroke-width:1px;");
        }

        // draw lines of lollipop
        // represent with rect so can 'morph' into a density chart seamlessly with rect-height
        svg_rl_bars.selectAll("rect")
            .data(working_data)
            .join(
                function(enter) {
                    return enter
                        .append("rect")
                        .attr("x", x_scale(0))
                        .attr("y", d => y_scale(d.route))
                        .attr("width", "0px")
                        .attr("stroke-width", "0px")
                        .attr("fill", "var(--org)");
                },
                function(update) {
                    return update
                        .attr("y", d => y_scale(d.route));
                },
                function(exit) {
                    return exit
                        .remove();
                }
            )
            .transition()
            .duration(ms)
            .attr("width", d => `${x_scale(d[factor])}px`)
            .attr("height", d => {
                if (
                    slice > svg_rl_viewlimit2 &&
                    working_data.includes(d, Math.floor(985/1000*working_data.length))
                    // Shave off last 1.5% of values when zoomed out
                ) {
                    return "0px";   
                } else if (slice <= svg_rl_viewlimit2) {
                    return "1px";
                    // then turn area chart into lollipops when zoomed in
                } else {
                    return "8px";
                // then turn lollipops into area chart when zoomed out and not in last 1.5% 
                }
            });

        // draw circles on ends of lollipops
        svg_rl_bars.selectAll("circle")
            .data(working_data)
            .join(
                function(enter) {
                    return enter
                        .append("circle")
                        .attr("cx", x_scale(0))
                        .attr("cy", d => y_scale(d.route))
                        .attr("r", "0px");
                },
                function(update) {
                    return update
                        .attr("cy", d => y_scale(d.route));
                },
                function(exit) {
                    return exit
                        .remove();
                }
            )
            .transition()
            .duration(ms)
            .attr("r", d => {
                if (slice <= svg_rl_viewlimit2) {
                    return (((1-(slice/svg_rl_viewlimit2))*2.5)+2) + "px";
                } else {
                    return "0px";
                };
            })
            .attr("cx", d => x_scale(d[factor]));

        // add invisible selection rects
        svg_rl_interaction.selectAll("rect")
            .data(working_data)
            .join(
                function(enter) {
                    return enter
                        .append("rect")
                        .attr("x", x_scale(0) - 55)
                        .attr("y", d => y_scale(d.route))
                        .attr("width", "0px")
                        .attr("stroke-width", "0px")
                        .attr("fill", "transparent");
                },
                function(update) {
                    return update
                        .attr("y", d => y_scale(d.route));
                },
                function(exit) {
                    return exit
                        .remove();
                }
            )
            .attr("width", d => `${x_scale(d[factor])+75}px`)
            .attr("height", 0.85*h/y_scale_list.length)
            .on("mouseover", (event, d) => {
                // make map visible
                svg_rl_inset_basemap.selectAll("path")
                    .transition()
                    .duration(250)
                    .attr("opacity", "1.0");
                // draw busroute on map
                let filteredArray = svg_rl_inset_data.filter(item => item.route_no === d.route);
                update_ls(filteredArray, svg_rl_g, 200, "svg_rl_g_ln"); // data, d3_selection, transition length (ms), class name
                // draw label
                let textspace = svg_rl_inset_text.selectAll("text")
                    .data(filteredArray)
                    .join(
                        function(enter) {
                            return enter
                                .append("text")
                                .attr("style", "font-family:'Inconsolata';")
                                .attr("transform", "translate(650,400)");
                        }
                    );
                textspace.text("Bus")
                    .attr("dy", "0")
                    .attr("font-size", "3.0em")
                    .attr("transform", "translate(650,400)");
                textspace.append("tspan")
                    .attr("dy", "0.9em")
                    .attr("x", -5)
                    .attr("font-size", "1.8em")
                    .text(d => d.route_no);
                textspace.append("tspan")
                    .attr("dy", "1.2em")
                    .attr("x", 0)
                    .attr("font-size", "1.0em")
                    .text(d => {
                        if(factor == "max_km") {
                            return d["max_km"] + " km"
                        } else {
                            return d["length"] + " stops"
                        }
                    })
                textspace.append("tspan")
                    .attr("dy", "1.2em")
                    .attr("x", 0)
                    .attr("font-size", "1.0em")
                    .text(d => {
                        if(factor == "max_km") {
                            return d["length"] + " stops"
                        } else {
                            return d["max_km"] + " km"
                        }
                    })
                // draw highlight rectangle
                d3.select(event.currentTarget)
                    .attr("stroke", "var(--fg4)")
                    .attr("stroke-width", "0.5px")
                    .attr("fill", "var(--gry)")
                    .attr("fill-opacity", "0.2");
                
            })
            .on("mouseout", (event, d) => {
                svg_rl_g.selectAll("path")
                    .remove();
                svg_rl_inset_basemap.selectAll("path")
                    .transition()
                    .duration(250)
                    .attr("opacity", "0");
                svg_rl_inset_text.selectAll("text")
                    .remove();
                d3.select(event.currentTarget)
                    .attr("stroke", "none")
                    .attr("fill", "transparent");
            });
    };

    // very magic function to make slider smooth (DO NOT TOUCH)
    function svg_rl_parse_slide(x) {
        // smooths range of [0,100] to exponential domain
        // x0-x3 are the breakpoints in input
        // y0-y3 are the breakpoints in output
        let x0 =  0, y0 =  8;
        let x1 = 66, y1 = svg_rl_viewlimit;
        let x2 = 83, y2 = svg_rl_viewlimit2;
        let x3 = 100, y3 = routes.length;
        if (x <= x1) {
            return (y0 + ((y1-y0)/(x1-x0)*(x-x0)) )
        } else if (x <= x2) {
            return (y1 + ((y2-y1)/(x2-x1)*(x-x1)) )
        } else if (x <= x3) {
            return (y2 + ((y3-y2)/(x3-x2)*(x-x2)) )
        }
    };
    // not-so-magic function to make scrolling work
    function svg_rl_parse_scroll(x) {
        return (100-x);
    }

    // initialise variables that various events will update
    let svg_rl_facet = "max_km"; // length or max_km
    let svg_rl_slice = svg_rl_init;
    let svg_rl_scroll = 0;
    update_rl(routes, svg_rl_init, 0, svg_rl_facet, 0); // initialise

    // listen for zoom slider events
    d3.select("#rl_slider").on("input", function(d) {
        let raw_value = this.value;
        svg_rl_slice = svg_rl_parse_slide(raw_value);
        let x0 =   0, y0 = 15;
        let x1 = 100, y1 = document.getElementById("route_lengths").clientHeight*0.9;
        let thumb_height = (y0 + ((y1-y0)/(x1-x0)*((svg_rl_slice/routes.length*100)-x0)) );
        document.documentElement.style.setProperty("--thumb_height", `${thumb_height}px`);
        update_rl(routes, svg_rl_slice, svg_rl_scroll, svg_rl_facet, 1000); // data, slice, factor
    });

    // listen for scroller events
    d3.select("#rl_scroller").on("input", function(d) {
        let raw_value = this.value;
        svg_rl_scroll = svg_rl_parse_scroll(raw_value);
        update_rl(routes, svg_rl_slice, svg_rl_scroll, svg_rl_facet, 250); // data, slice, factor
    });

    // listen for dropdown faceting events
    d3.select("#rl_dropdown").on("input", function(d) {
        svg_rl_facet = this.value;
        update_rl(routes, svg_rl_slice, svg_rl_scroll, svg_rl_facet, 750); // data, slice, factor
    });


    // 4. Drawing svg histogram

    // Define area to draw on
    let svg_hs_chart = svg_hs.append("g")
        .attr("class", "svg_hs_chart")
        .attr("transform", "translate(" + (w*0.1) + "," + (h*0.1) + ")" );
    let svg_hs_chart_bars = svg_hs_chart.append("g")
        .attr("class", "svg_hs_chart_bars");
    let svg_hs_axes = svg_hs_chart.append("g")
        .attr("class", "svg_hs_axes");
    let svg_hs_x_lab = svg_hs_chart.append("text")
        .attr("class", "axis_text")
        .attr("text-anchor", "middle")
        .attr("x", w*0.40)
        .attr("y", h*0.88);
    let svg_hs_y_lab = svg_hs_chart.append("text")
        .attr("class", "axis_text")
        .attr("text-anchor", "middle")
        .attr("x", -w*0.04)
        .attr("y", 0)
        .text("n");
    let svg_hs_meandian = svg_hs_chart.append("g")
        .attr("class", "svg_hs_meandian");

    // Attach controls
    let svg_hs_dropdown_form = d3.select("div.svg_hs_dropdown")
        .append("form");
    svg_hs_dropdown_form.append("label")
            .attr("for", "hs_dropdown");
    let svg_hs_dropdown_form_select = svg_hs_dropdown_form.append("select")
        .attr("class", "dropdown")
        .attr("name", "hs_dropdown")
        .attr("id", "hs_dropdown");
    svg_hs_dropdown_form_select.append("option")
        .attr("value", "max_km")
        .text("View routes by length (km)");
    svg_hs_dropdown_form_select.append("option")
        .attr("value", "length")
        .text("View routes by number of stops");

    // Define axes
    let svg_hs_x = svg_hs_axes.append("g")
        .attr("transform", "translate(0," + (h * 0.8) + ")")
        .attr("class", "axis_text")
    let svg_hs_y = svg_hs_axes.append("g")
        .attr("class", "axis_text");

    function update_hs(data, bins, factor) {

        // Define scales
        let x_scale = d3.scaleLinear()
            .domain([0, d3.max(data, d => +d[factor]) ])
            .range([0, w * 0.80])
            .nice();
        let histogram = d3.histogram()
            .value(d => d[factor])
            .domain(x_scale.domain())
            .thresholds(x_scale.ticks(bins));
        let bars = histogram(data);
        let y_scale = d3.scaleLinear()
            .range([(h * 0.8), 0])
            .domain([0, d3.max(bars, d => d.length)])
            .nice();
        
        svg_hs_x.transition().duration(750).call(d3.axisBottom(x_scale));
        svg_hs_y.transition().duration(750).call(d3.axisLeft(y_scale));
        svg_hs_x_lab.text(d => {if (factor == "max_km") {return "km"} else {return "stops"}});
        
        svg_hs_chart_bars.selectAll("rect")
            .data(bars)
            .join(
                function(enter) {
                    return enter
                        .append("rect")
                        .attr("x", 1)
                        .attr("width", d => x_scale(d.x1) - x_scale(d.x0) - 3 )
                        .attr("height", "0");
                }, 
                function(update) {
                    return update;
                },
                function(exit) {
                    return exit
                        .remove();
                }
            )
            .attr("class", "svg_hs_bars")
            .transition()
            .duration(750)
            .attr("height", d => (h * 0.8) - y_scale(d.length))
            .attr("transform", d => "translate(" + x_scale(d.x0) + "," + y_scale(d.length) + ")" );
        
        // calculate mean
        let factorchooser = (data, factor) => {
            return data.map((item) => {return item[factor]});
        }
        let data_mean = [d3.mean(factorchooser(data, factor))];
            
        // add mean line
        svg_hs_meandian.selectAll("line").remove();
        svg_hs_meandian.selectAll("line")
            .data(data_mean)
            .join(
                function(enter) {
                    return enter
                        .append("line")
                        .attr("x1", d => x_scale(d))
                        .attr("x2", d => x_scale(d))
                        .attr("y1", 0)
                        .attr("y2", y_scale(0));
                    },
                function(update) {
                    return update
                        .remove();
                },
                function(exit) {
                    return exit
                        .remove();
                }
            )
            .attr("stroke", "blue")
            .attr("stroke-width", 3)
            .attr("stroke-opacity", 0.4);
        // add mean label
        svg_hs_meandian.selectAll("text").remove();
        svg_hs_meandian.selectAll("text")
            .data(data_mean)
            .join(
                function(enter) {
                    return enter
                        .append("text")
                },
                function(update) {
                    return update.remove();
                },
                function(exit) {
                    return exit.remove();
                }
            )
            .attr("transform", d => "translate(" + (x_scale(d)+w*0.015) + "," + (y_scale(0)*0.1) + ")")
            .attr("class", "axis_text")
            .text(d => {
                if (factor == "max_km") {
                    return "mean \u2248 " + Math.round(d) + " km"
                } else {
                    return "mean \u2248 " + Math.round(d) + " stops"
                };
            });

    };

    let svg_hs_facet = "max_km"; // length or max-km
    let svg_hs_bins = 50;
    update_hs(routes, svg_hs_bins, svg_hs_facet); // initialise

    d3.select("#hs_dropdown").on("input", function(d) {
        svg_hs_facet = this.value;
        console.log(svg_hs_facet);
        update_hs(routes, svg_hs_bins, svg_hs_facet); // data, slice, factor
    });

    // 5. Additional things to draw
    // ?. Hexbin of bus service density (number of lines * number of stops) (basically a raw count of all lines' stops within a hex) (can divide by number of stops to figure out number of lines passing through a hex)

});