if (!visualisations) {
    var visualisations = {};
}

//IIFE to prvide shared scope for sharing state and constants between the controller 
//object and each grid cell object instance
(function(){
    var d3 = window.d3;
    var commonFunctions = visualisations.commonFunctions;
    var commonConstants = visualisations.commonConstants;
    var margins = commonConstants.margins();

    //Instantiated by Stroom
    visualisations.Sunburst = function(containerNode) {

        //Stroom creates a new iFrame for each visualisation so
        //create a div for the gridded visualisation to be built in
        if (containerNode){
        var element = containerNode;
        } else {
        var element = window.document.createElement("div");
        }
        this.element = element;

        var grid = new visualisations.GenericGrid(this.element);
        var radius, partition, arc, svgGroup, nodes, path, visSettings;
        var width = commonFunctions.gridAwareWidthFunc(true, containerNode, element, margins);
        var height = commonFunctions.gridAwareHeightFunc(true, containerNode, element, margins);
        // var width;
        // var height;
        var svg;
        var tip;
        var inverseHighlight;
        var stroomData;
        var x,y;

        var color = commonConstants.categoryGoogle();

        // var zoom = d3.behavior.zoom()
        //     .scaleExtent([0.1, 10])
        //     .on("zoom", zoomed);
        // zoom.translate([width / 2, height / 2]);

        //Called by GenericGrid to create a new instance of the visualisation for each cell.
        this.getInstance = function(containerNode) {
            return new visualisations.Sunburst(containerNode);
        };

        //called by Stroom to pass snapshots of the data as it gathers the query results
        //context - an object containing any shared context between Stroom and the visualisation,
        //          e.g. a common colour scale could be used between multiple visualisations
        //settings - the object containing all the user configurable settings for the visualisation,
        //           e.g. showLabels, displayXAxis, etc.
        //d - the object tree containing all the data. Always contains all data currently available
        //    for a query.
        this.setData = function(context, settings, d) {
            if (context) {
                if (context.color) {
                  color = context.color;
                } else {
                  context.color = color;
                }
            }
      
            if (settings){
              //Inspect settings to determine which axes to synch, if any.
              //Change the settings property(s) used according to the vis
              var synchedFields = [];
              if (commonFunctions.isTrue(settings.synchXAxis)){
                  synchedFields.push(0);
              }
              if (commonFunctions.isTrue(settings.synchYAxis)){
                  synchedFields.push(1);
              }
      
              if (commonFunctions.isTrue(settings.synchSeries)) {
                  //series are synched so setup the colour scale domain and add it to the context
                  //so it can be passed to each grid cell vis
                  context.color = colour;
              } else {
                  //ensure there is no colour scale in the context so each grid cel vis can define its own
                  delete context.color;
              }

            // width = commonFunctions.gridAwareWidthFunc(true, containerNode, element, margins);
            // height = commonFunctions.gridAwareHeightFunc(true, containerNode, element, margins);
            
              //Get grid to construct the grid cells and for each one call back into a
              //new instance of this to build the visualisation in the cell
              //The last array arg allows you to synchronise the scales of fields
              grid.buildGrid(context, settings, d, this, commonConstants.transitionDuration, synchedFields);
            }
        }

        //called by Stroom to instruct the visualisation to redraw itself in a resized container
        this.resize = function() {
            commonFunctions.resize(grid, update, element, margins, width, height);
        };

        //Called by GenericGrid to establish which position in the values array
        //(or null if it is the series key) is used for the legend.
        this.getLegendKeyField = function() {
            return null;
        };

        //called by GenercGrid to build/update a visualisation inside a grid cell
        //context - an object containing any shared context between Stroom and the visualisation,
        //          e.g. a common colour scale could be used between multiple visualisations.
        //          Also can be used by the grid to pass state down to each cell
        //settings - the object containing all the user configurable settings for the visualisation,
        //           e.g. showLabels, displayXAxis, etc.
        //data - the object tree containing all the data for that grid cell. Always contains all data 
        //       currently available for a query.
        this.setDataInsideGrid = function(context, settings, data) {
        
            // If the context already has a colour set then use it
            if (context) {
                visContext = context;
                if (context.color) {
                    colour = context.color;
                }
            }
    
            if (data) {
                stroomData = data;
                update(500, data.values[0], settings);
            }
        };

        // Variable to store the expanded state
        let expandedNode = null;

        // Function to update the visualization
        var update = function(duration, d, settings) {
            visSettings = settings;

            // Calculate dimensions and radius
            width = commonFunctions.gridAwareWidthFunc(true, containerNode, element, margins);
            height = commonFunctions.gridAwareHeightFunc(true, containerNode, element, margins);
            radius = Math.min(width, height) / 2;

            console.log("Width: " + width);
            console.log("Height: " + height);
            console.log("Radius: " + radius);

            // d3.select(element).select("svg").remove();
            svg = d3.select(element).append("svg")
                    .attr("width", width)
                    .attr("height", height)
                    .append("g")
                    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

            // Apply zoom behavior to the g element
            // svg.call(zoom);

            x = d3.scale.linear()
                .range([0, 2 * Math.PI]);

            y = d3.scale.sqrt()
                .range([0, radius]);


            
            partition = d3.layout.partition()
                .value(function(d) { 
                    console.log("size " + d.value);
                    return d.value; }); 

            arc = d3.svg.arc()
                .startAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x))); })
                .endAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))); })
                .innerRadius(function(d) { return Math.max(0, y(d.y)); })
                .outerRadius(function(d) { return Math.max(0, y(d.y + d.dy)); });


            // Update nodes based on the expanded state
            // if (expandedNode) {
            //     nodes = partition.nodes(expandedNode);
            // } else {
            //     nodes = partition.nodes(d.values[0]);
            // }

            // nodes.forEach(function(node) {
            //     node.visible = true;
            // });

            // if (typeof(tip) == "undefined") {
            //     // initializeRoot(d);
            //     inverseHighlight = commonFunctions.inverseHighlight();

            //     inverseHighlight.toSelectionItem = function(d) {
            //         var selection = {
            //             key: d.name,
            //             value: d.value,
            //         };
            //         return selection;
            //     };

            //     tip = inverseHighlight.tip()
            //         .html(function(tipData) {
            //             var html = inverseHighlight.htmlBuilder()
            //                 .addTipEntry("Name", commonFunctions.autoFormat(tipData.values.name))
            //                 .addTipEntry("Value", commonFunctions.autoFormat(tipData.values.value))
            //                 .build();
            //             return html;
            //         });
            // }

            // svg.call(tip);
                    

            svg.selectAll("path")
                    .data(partition.nodes(d.values[0]))
                .enter().append("path")
                    // .attr("display", null)
                    .attr("d", arc)
                    .style("stroke", "var(--vis__background-color)")
                    .style("fill", function(d) {
                        return color((d.children ? d : d.parent).name);
                    })
                    // .style("fill-rule", "evenodd")
                    .on("click", click);

            // updateLabels();

            // commonFunctions.addDelegateEvent(svg, "mouseover", "path", inverseHighlight.makeInverseHighlightMouseOverHandler(stroomData.key, stroomData.types, svg, "path"));
            // commonFunctions.addDelegateEvent(svg, "mouseout", "path", inverseHighlight.makeInverseHighlightMouseOutHandler(svg, "path"));

            // commonFunctions.addDelegateEvent(svg, "mousewheel", "path", inverseHighlight.makeInverseHighlightMouseOutHandler(svg, "path"));
            // commonFunctions.addDelegateEvent(svg, "mousedown", "path", inverseHighlight.makeInverseHighlightMouseOutHandler(svg, "path"));
        };

        function click(d) {
            svg.transition()
                .duration(750)
                .tween("scale", function() {
                  var xd = d3.interpolate(x.domain(), [d.x, d.x + d.dx]),
                      yd = d3.interpolate(y.domain(), [d.y, 1]),
                      yr = d3.interpolate(y.range(), [d.y ? 20 : 0, radius]);
                  return function(t) { x.domain(xd(t)); y.domain(yd(t)).range(yr(t)); };
                })
              .selectAll("path")
                .attrTween("d", function(d) { return function() { return arc(d); }; });
        }

        //d3.select(self.frameElement).style("height", height + "px");

        // Global variable for the root node
        // var root;

        // // Function to initialize or set root
        // function initializeRoot(data) {
        //     root = data.values[0];
        // }

        // // Function to handle the click event
        // function clicked(d) {
        //     if (!root) {
        //         console.error("Root node is not defined.");
        //         return;
        //     }

        //     var target = d.parent || root;

        //     // Calculate target properties for all nodes
        //     calculateTargetProperties(root, target);

        //     // Define the transition
        //     var t = svg.transition().duration(750);

        //     // Transition the data on all arcs
        //     path.transition()
        //         .duration(750)
        //         .attrTween("d", function(node) {
        //             var interpolate = d3.interpolate({
        //                 x: node.x,
        //                 dx: node.dx
        //             }, {
        //                 x: node.target.x,
        //                 dx: node.target.dx
        //             });
        //             return function(t) {
        //                 var interpolated = interpolate(t);
        //                 node.x = interpolated.x;
        //                 node.dx = interpolated.dx;
        //                 return arc(node);
        //             };
        //         })
        //         .style("fill-opacity", function(node) {
        //             return arcVisible(node) ? (node.children ? 0.6 : 0.4) : 0;
        //         })
        //         .style("pointer-events", function(node) {
        //             return arcVisible(node) ? "auto" : "none";
        //         });
        // }

        // // Recursive function to calculate target properties for all nodes
        // function calculateTargetProperties(node, target) {
        //     node.target = {
        //         x: Math.max(0, Math.min(1, (node.x - target.x) / target.dx)) * 2 * Math.PI,
        //         dx: Math.max(0, node.dx / target.dx) * 2 * Math.PI,
        //         y: Math.max(0, node.y - target.depth),
        //         dy: Math.max(0, node.dy)
        //     };

        //     if (node.children) {
        //         node.children.forEach(function(child) {
        //             calculateTargetProperties(child, target);
        //         });
        //     }
        // }

        // // Helper functions for visibility checks
        // function arcVisible(d) {
        //     return d.y + d.dy <= 3 && d.y >= 1 && d.x + d.dx > d.x;
        // }

        // function updateLabels() {
        //     svgGroup.selectAll("text.label").remove();
        //     svgGroup.selectAll("text.explode-button").remove();
        //     svgGroup.selectAll("text.back-button").remove();

        //     path.each(function(d) {
        //         if (d.visible && commonFunctions.isTrue(visSettings.showLabels)) {
        //             var centroid = arc.centroid(d);
        //             var startAngle = d.x;
        //             var endAngle = d.x + d.dx;
        //             var innerRadius = d.y;
        //             var outerRadius = d.y + d.dy;
        //             var arcLength = (endAngle - startAngle) * (outerRadius + innerRadius) / 2;
        //             var scale = d3.event && d3.event.scale ? d3.event.scale : 1;
        //             var fontSize = 13 / scale;

        //             // Create a temporary text element to measure the text width
        //             var tempText = svg.append("text")
        //                 .attr("class", "temp-text")
        //                 .attr("text-anchor", "middle")
        //                 .style("font-size", fontSize + "px")
        //                 .style("visibility", "hidden")
        //                 .text(function() {
        //                     if (d.name != null) {
        //                         return commonFunctions.autoFormat(d.name, visSettings.nameDateFormat);
        //                     } else {
        //                         return commonFunctions.autoFormat(d.series, visSettings.seriesDateFormat);
        //                     }
        //                 });

        //             var textWidth = tempText.node().getComputedTextLength();
        //             tempText.remove();

        //             if (textWidth < arcLength) {
        //                 var angle = (startAngle + endAngle) / 2;
        //                 angle = angle * (180 / Math.PI) + 90; // Convert to degrees

        //                 // Adjust the angle to keep the text upright
        //                 if (angle > 90 && angle < 270) {
        //                     angle += 180;
        //                 }
        //                 if (d.depth == 0) {
        //                     angle = 0;
        //                 }

        //                 svgGroup.append("text")
        //                     .attr("class", "label")
        //                     .attr("transform", "translate(" + centroid[0] + "," + centroid[1] + ") rotate(" + angle + ")")
        //                     .attr("text-anchor", "middle")
        //                     .attr("dy", ".35em")
        //                     .style("pointer-events", "none")
        //                     .style("font-size", fontSize + "px")
        //                     .style("text-rendering", "geometricPrecision")
        //                     .text(function() {
        //                         if (d.name != null) {
        //                             return commonFunctions.autoFormat(d.name, visSettings.nameDateFormat);
        //                         } else {
        //                             return commonFunctions.autoFormat(d.series, visSettings.seriesDateFormat);
        //                         }
        //                     });
        //             }
        //         }
        //     });
        // }

        // Global object to keep track of previous states
        // var previousStates = {};

        // function expandArc(d) {
        //     expandedNode = d;

        //     // Set all nodes as invisible
        //     nodes.forEach(function(node) {
        //         node.visible = false;
        //     });

        //     // Set the clicked node as visible
        //     d.visible = true;
        //     if (d.children) {
        //         d.children.forEach(function(child) {
        //             markVisible(child);
        //         });
        //     }

        //     // Partition nodes based on the expanded node
        //     nodes = partition.nodes(d);

        //     // Remove existing paths
        //     svgGroup.selectAll("path").remove();

        //     // Bind new data to paths
        //     var newPath = svgGroup.selectAll("path")
        //         .data(nodes, function(d) { return d.name; }) // Use name as unique identifier
        //         .enter().append("path")
        //         .style("stroke", "var(--vis__background-color)")
        //         .style("fill", function(d) { return color((d.children ? d : d.parent).name); })
        //         .style("fill-rule", "evenodd");

        //     // Store the previous states
        //     newPath.each(function(d) {
        //         previousStates[d.name] = previousStates[d.name] || {
        //             d: arc(d), // Initial state of the path
        //             node: d
        //         };
        //     });

        //     // Apply transitions
        //     newPath.transition()
        //         .duration(750)
        //         .attrTween("d", function(d) {
        //             var prevState = previousStates[d.name];
        //             if (prevState) {
        //                 var interpolate = d3.interpolate(
        //                     { d: prevState.d.startAngle },
        //                     { d: arc(d).endAngle }
        //                 );
        //                 return function(t) {
        //                     return interpolate(t).d;
        //                 };
        //             } else {
        //                 return function() {
        //                     return arc(d);
        //                 };
        //             }
        //         })
        //         .each("end", function(d) {
        //             previousStates[d.name] = { 
        //                 d: arc(d),
        //                 node: d
        //             };
        //         });
        // }

        // function markVisible(d) {
        //     d.visible = true;
        //     if (d.children) {
        //         d.children.forEach(markVisible);
        //     }
        // }

            
        // function zoomed() {
        //     // Apply translation and scaling to the arcs
        //     svgGroup.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
            
        //     updateLabels();            
        // }

        // Used to provide the visualisation's D3 colour scale to the grid
        this.getColourScale = function() {
            return color;
        };

    };

}());