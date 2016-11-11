/*
 * Copyright 2016 Crown Copyright
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * This visualisation is a modified version of Tomer Doron's gauge 
 * example found at:
 *
 * http://bl.ocks.org/tomerd/1499279
 *
 * which in turn is a modified version of Google's gauge found at:
 *
 * https://developers.google.com/chart/interactive/docs/gallery/gauge?csw=1
 *
 * which is licenced under the Apache 2.0 licence.
 */


if (!visualisations) {
    var visualisations = {};
}

//IIFE to prvide shared scope for sharing state and constants between the controller 
//object and each grid cell object instance
(function(){
    var d3 = window.d3;
    var commonFunctions = visualisations.commonFunctions;
    var commonConstants = visualisations.commonConstants;

    //Constant declarations
    var COLOUR_OUTLIER = visualisations.commonConstants.googleGrey500;
    var COLOUR_GREEN = visualisations.commonConstants.googleGreen500;
    var COLOUR_AMBER = visualisations.commonConstants.googleAmber500;
    var COLOUR_RED = visualisations.commonConstants.googleRed500;
    var STATUS_OUTLIER = "Outlier";
    var STATUS_GREEN = "Green";
    var STATUS_AMBER = "Amber";
    var STATUS_RED = "Red";

    var createRangeText = function(from, to) {
        return commonFunctions.autoFormat(from) + " - " + commonFunctions.autoFormat(to);
    };
    var statusToRangeTextMap = {};

    visualisations.Gauge = function() {
        this.element = window.document.createElement("div");
        var grid = new visualisations.GenericGrid(this.element);

        var colour;

        //A reverse scale to map a css colour value back to a status band
        //i.e. COLOUR_GREEN --> STATUS_GREEN
        var reverseLegendColourScale = d3.scale.ordinal()
            .range([
                STATUS_GREEN,
                STATUS_AMBER,
                STATUS_RED,
                STATUS_OUTLIER
            ])
            .domain([
                COLOUR_GREEN,
                COLOUR_AMBER,
                COLOUR_RED,
                COLOUR_OUTLIER
            ]);

        //builds a colour scale based on the thresholds passed in 
        //the vis settings
        var createColourScale = function(settings) {
            var greenRedDomain = [
                settings.GreenLo,
                settings.GreenHi,
                settings.AmberLo,
                settings.AmberHi,
                settings.RedLo,
                settings.RedHi
            ];
            //clone and reverse the array
            var redGreenDomain = greenRedDomain.slice(0).reverse();
            var greenRedRange = [
                COLOUR_OUTLIER,
                COLOUR_GREEN,
                COLOUR_OUTLIER,
                COLOUR_AMBER,
                COLOUR_OUTLIER,
                COLOUR_RED,
                COLOUR_OUTLIER
            ];
            //clone and reverse the array
            var redGreenRange = greenRedRange.slice(0).reverse();

            if (settings.GreenHi > settings.GreenLo) {
                //Green-Amber-Red scale
                var scale = d3.scale.threshold()
                    .domain(greenRedDomain)
                    .range(greenRedRange);
            } else {
                //Red-Amber-Green scale
                var scale = d3.scale.threshold()
                    .domain(redGreenDomain)
                    .range(redGreenRange);
            }
            return scale;
        };

        //Method to allow the grid to call back in to get new instances for each cell
        this.getInstance = function(containerNode) {
            return new visualisations.Gauge.Visualisation(containerNode);
        };

        this.setData = function(context, settings, data) {

            if (data && data !==null) {
                // If the context already has a colour set then use it, otherwise set it
                // to use this one.
                if (context) {
                    if (context.color) {
                        colour = context.color;
                    } else {
                        colour = createColourScale(settings);
                        context.color = colour;
                    }
                }

                //#########################################################
                //Perform any visualisation specific data manipulation here
                //#########################################################
                if (settings){
                    statusToRangeTextMap[STATUS_GREEN] = createRangeText(settings.GreenLo, settings.GreenHi);
                    statusToRangeTextMap[STATUS_AMBER] = createRangeText(settings.AmberLo,settings.AmberHi);
                    statusToRangeTextMap[STATUS_RED] = createRangeText(settings.RedLo,settings.RedHi);
                    statusToRangeTextMap[STATUS_OUTLIER] = "Outlier";
                }

                if (data.values) {
                    data.values.forEach(function(gridCellData) {
                        var colourBand = colour(gridCellData.values[0][0]);
                        var status = reverseLegendColourScale(colourBand);
                        gridCellData.values[0][1] = status;
                        gridCellData.values[0][2] = statusToRangeTextMap[status];
                    });
                }

                if (settings) {
                    data.values = data.values.filter(function(d) {
                        //defualt to true if the setting is not supplied
                        var displayGreens = commonFunctions.isTrue(settings.displayGreens, true);
                        var colourValue = d.values[0][1];
                        //remove and values above/below/between the three status bands and also greens if
                        //the settings say to do that
                        return (displayGreens || (!displayGreens && colourValue != STATUS_GREEN)) ;
                    });
                    var synchedFields = [];

                    //Get grid to construct the grid cells and for each one call back into a 
                    //new instance of this to build the visualisation in the cell
                    //The last array arg allows you to synchronise the scales of fields
                    grid.buildGrid(context, settings, data, this, commonConstants.transitionDuration, synchedFields);
                }
            }

            //data = d.values;
            //config = settings;
            //update(1000);
        };

        this.resize = function() {
            grid.resize();
        };

        this.getLegendKeyField = function() {
            return 2;
        };

    };
    //
    //This is the content of the visualisation inside the containerNode
    //One instance will be created per grid cell
    visualisations.Gauge.Visualisation = function(containerNode) {

        var element = containerNode;
        var margins = commonConstants.margins();
        var width;
        var height;
        var tip;
        var inverseHighlight;

        if (typeof(tip) == "undefined") {
            inverseHighlight = commonFunctions.inverseHighlight();
            tip = inverseHighlight.tip()
                .html(function(tipData) { 
                    var html = inverseHighlight.htmlBuilder()
                        .addTipEntry("Value",commonFunctions.autoFormat(tipData.values[0]))
                        .addTipEntry("Status",tipData.values[1])
                        .addTipEntry("Range",statusToRangeTextMap[tipData.values[1]])
                        .build();
                    return html;
                });
        }
        // Add the series data.
        var seriesContainer;
        var visData;
        var visSettings;
        var visContext;

        var canvas = d3.select(element)
            .append("svg:svg");

        var svg = canvas.append("svg:g");
        
        // Add the series data.
        seriesContainer = svg.append("svg:g")
            .attr("class", "vis-series");

        var self = this; // for internal d3 functions

        var pointerLine = d3.svg.line()
            .x(function(d) { return d.x })
            .y(function(d) { return d.y })
            .interpolate("basis");

        var data, range ;
        //
        //Public entry point for the Grid to call back in to set the cell level data on the cell level 
        //visualisation instance.
        //data will only contain the branch of the tree for this cell
        this.setDataInsideGrid = function(context, settings, data, visSpecificState) {

            // If the context already has a colour set then use it
            if (context) {
                visContext = context;
                if (context.color) {
                    colour = context.color;
                }
            }

            if (settings){
                visSettings = settings;
            }

            visData = data;
            update(0);
        };

        var update = function(duration) {
            if (visData) {
                var visibleValues = visData.visibleValues();
                width = commonFunctions.gridAwareWidthFunc(true, containerNode, element);
                height = commonFunctions.gridAwareHeightFunc(true, containerNode, element);
                fullWidth = commonFunctions.gridAwareWidthFunc(false, containerNode, element);
                fullHeight = commonFunctions.gridAwareHeightFunc(false, containerNode, element);
                canvas
                    .attr("width", fullWidth)
                    .attr("height", fullHeight);

                svg.attr("transform", "translate(" + margins.left + "," + margins.top + ")");
                seriesContainer.call(tip);

                var g = seriesContainer.selectAll(".gauge")
                    .data(visibleValues);
                
                var gaugeCurrentValue = visibleValues[0][0];
                var gaugeCurrentStatus = visibleValues[0][1];
                var gaugeCurrentRangeText = visibleValues[0][2];

                var legendKeyClass = "vis-legend-key-" + commonFunctions.generateHash(statusToRangeTextMap[gaugeCurrentStatus]);

                range = visSettings.RedHi - visSettings.GreenLo;

                //greenLo may not be zero based, so have to convert to a value that is zero based for the gauge
                var absoluteToRelative = function(absValue) {
                    return absValue - visSettings.GreenLo;
                };

                var ge = g.enter()
                    .append("svg:svg")
                    .attr("class","gauge");

                ge.append("svg:circle")
                    .attr("class", "outer")
                    .attr("cx", 0)
                    .attr("cy", 0)
                    .attr("r", 50)
                    .style("fill", "#ccc")
                    .style("stroke", "#000")
                    .style("stroke-width", "0.5px");

                ge.append("svg:circle")
                    .attr("class", "inner")
                    .attr("cx", 0)
                    .attr("cy", 0)
                    .attr("r", 45)
                    .style("fill", "#fff")
                    .style("stroke", "#e0e0e0")
                    .style("stroke-width", "2px");

                ge.append("svg:text")
                    .classed("value", true)
                    .classed("vis-coloured-element", true)
                    .classed(legendKeyClass, true)
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("dy", 8)
                    .attr("text-anchor", "middle")
                    .style("font-size","10px")
                    .style("fill", "#333")
                    .style("stroke-width", "0px");

                self.drawBand(ge,absoluteToRelative(visSettings.GreenLo), absoluteToRelative(visSettings.GreenHi), COLOUR_GREEN, STATUS_GREEN, gaugeCurrentStatus);
                self.drawBand(ge,absoluteToRelative(visSettings.AmberLo), absoluteToRelative(visSettings.AmberHi), COLOUR_AMBER, STATUS_AMBER, gaugeCurrentStatus);
                self.drawBand(ge,absoluteToRelative(visSettings.RedLo), absoluteToRelative(visSettings.RedHi), COLOUR_RED, STATUS_RED, gaugeCurrentStatus);

                var majorDelta = (range) / 10 ;
                for (var major = 0; major <= 10; major++) {
                    self.drawMajorTick(ge,majorDelta*major,(majorDelta*major+majorDelta/100),"black");
                }

                var majorDelta = (range) / 100 ;
                for (var major = 0; major <= 100; major++) {
                    self.drawMinorTick(ge, majorDelta * major, (majorDelta * major + majorDelta / 10), "black");
                }

                var pointerContainer = ge.append("svg:g")
                    .classed("pointerContainer", true);

                pointerContainer.append("svg:path")
                    //.attr("class", "pointer")
                    .classed("pointer", true)
                    .classed("vis-coloured-element", true)
                    .classed(legendKeyClass, true)
                    .style("fill", "#900000")
                    .style("fill-opacity", 1);

                var pointerCircle = pointerContainer.append("svg:circle")
                    .classed("pointerCircle", true)
                    .classed("vis-coloured-element", true)
                    .classed(legendKeyClass, true)
                    .attr("cx", 0)
                    .attr("cy", 0)
                    .attr("r", 0.12 * 45)
                    .style("fill", "#383838")
                    .style("opacity", 1);

                g.exit()
                    .transition()
                    .duration(duration)
                    .style("opacity",0)
                    .remove();

                g.transition()
                    .duration(duration)
                    .selectAll("circle")
                    .style("opacity",1);

                g.transition()
                    .duration(0)
                    .selectAll(".pointer");

                g.each(function(d) {
                    var e = d3.select(this);

                    var circleInner = e.select(".inner");
                    var circleOuter = e.select(".outer");
                    var pointer = e.select(".pointer");
                    var pointerCircle = e.select(".pointerCircle");

                    var greenBand = e.select("." + STATUS_GREEN.toLowerCase());
                    var amberBand = e.select("." + STATUS_AMBER.toLowerCase());
                    var redBand = e.select("." + STATUS_RED.toLowerCase());

                    var count = e.select(".value");
                    var ticks = e.selectAll(".tick");

                    var bbc = circleOuter.node()
                        .getBBox();
                    var scale = Math.min((width -10) / bbc.width,(height -10) / bbc.height);

                    circleOuter.attr("transform","translate("+width/2 +","+height/2 +")scale("+scale+")");
                    circleInner.attr("transform","translate("+width/2 +","+height/2 +")scale("+scale+")");
                    pointer.attr("transform","translate("+width/2 +","+height/2 +")scale("+scale+")");
                    pointerCircle.attr("transform","translate("+width/2 +","+height/2 +")scale("+scale+")");
                    greenBand.attr("transform","translate("+width/2 +","+height/2 +")scale("+scale+") rotate(270)");
                    amberBand.attr("transform","translate("+width/2 +","+height/2 +")scale("+scale+") rotate(270)");
                    redBand.attr("transform","translate("+width/2 +","+height/2 +")scale("+scale+") rotate(270)");
                    count.attr("transform","translate("+((width/2)-(bbc.width*scale*.07)) +","+(((height/2)+(bbc.height*scale*.25)))+")scale("+scale*0.75+")");

                    ticks.each(function (d) {
                        var e = d3.select(this);
                        e.attr("transform","translate("+width/2 +","+(height/2) +")scale("+scale+")rotate(270)");
                    });

                    count.text(commonFunctions.autoFormat(gaugeCurrentValue));

                    var gaugeAmendedValue = gaugeCurrentValue;

                    if (gaugeCurrentValue > visSettings.RedHi) {
                        //value is above the red range so change the text colour
                        //and put the pointer just outside the red band
                        gaugeAmendedValue = visSettings.RedHi + (range * 0.03); 
                        count
                            .style("fill", commonConstants.googleRed500)
                            .style("font-weight", "700");
                    } else if (gaugeCurrentValue < visSettings.GreenLo) {
                        //value is below the green range so change the text colour
                        //and put the pointer just below the green band
                        gaugeAmendedValue = visSettings.GreenLo - (range * 0.03); 
                        count
                            .style("fill", commonConstants.googleRed500)
                            .style("font-weight", "700");
                    } else {
                        count
                            .style("fill", commonConstants.googlePrimaryText)
                            .style("font-weight", "400");
                    }

                    //console.log("gaugeCurrentValue: " + gaugeCurrentValue + " gaugeAmendedValue: " + gaugeAmendedValue + "rel: " + absoluteToRelative(gaugeAmendedValue));
                    var pointerPath = buildPointerPath(absoluteToRelative(gaugeAmendedValue));
                    var temp = pointerLine(pointerPath);
                    pointer.attr("d",temp);
                });

                //add the hover tip mouse events on the apprpriate path
                var cssSelector = "path.active";
                commonFunctions.addDelegateEvent(
                    g, 
                    "mouseover", 
                    cssSelector, 
                    inverseHighlight.makeInverseHighlightMouseOverHandler("DUMMY_SERIES_KEY", visData.types, seriesContainer, cssSelector, pointerCircle.node()));

                commonFunctions.addDelegateEvent(
                    g, 
                    "mouseout", 
                    cssSelector, 
                    inverseHighlight.makeInverseHighlightMouseOutHandler(seriesContainer, cssSelector, pointerCircle.node()));
            }
        };

        //this.drawBand = function(g, start, end, colour, status, currentStatus) {
        this.drawBand = function(g, start, end, colour, status, currentStatus) {
            if (0 >= end - start) return;
            if (currentStatus === STATUS_OUTLIER) return;

            //Make the active band thicker to draw attention to it
            var innerRadiusFactor = (status === currentStatus ? 0.65 : 0.80);
            var activeBandClass = (status === currentStatus ? "active" : "");

            g.append("svg:path")
                .classed("vis-coloured-element", true)
                //.classed(vis)
                .classed("vis-legend-key-" + commonFunctions.generateHash(statusToRangeTextMap[currentStatus]), true)
                .classed(status.toLowerCase(), true)
                .classed(activeBandClass, true)
                .style("fill", colour)
                .attr("d", d3.svg.arc()
                    .startAngle(this.valueToRadians(start))
                    .endAngle(this.valueToRadians(end))
                    .innerRadius(innerRadiusFactor * 50)
                    .outerRadius(0.85 * 50)
                )
                .attr("transform", function() { 
                    return "translate(" + width/2 + 
                        ", " + height/2 + 
                        ") rotate(270)" 
                });
        };

        this.drawMajorTick = function(g, start, end, colour) {
            if (0 >= end - start) return;

            g.append("svg:path")
                .attr("class","tick")
                .style("fill", colour)
                .attr("d", d3.svg.arc()
                    .startAngle(this.valueToRadians(start))
                    .endAngle(this.valueToRadians(end))
                    .innerRadius(0.75 * 50)
                    .outerRadius(0.85 * 50)
                )
                .attr("transform", function() { 
                    return "translate(" + width/2 + 
                        ", " + height/2 + 
                        ") rotate(270)" 
                });
        };

        this.drawMinorTick = function(g, start, end, colour) {
            if (0 >= end - start) return;

            g.append("svg:path")
                .attr("class","tick")
                .style("fill", colour)
                .attr("d", d3.svg.arc()
                    .startAngle(this.valueToRadians(start))
                    .endAngle(this.valueToRadians(end))
                    .innerRadius(0.80 * 50)
                    .outerRadius(0.85 * 50)
                )
                .attr("transform", function() { 
                    return "translate(" + width/2 + 
                        ", " + height/2 + 
                        ") rotate(270)"; 
                });
        }

        var buildPointerPath = function(value) {
            var delta = range / 9;

            var head = valueToPoint(value, 0.85);
            var head1 = valueToPoint(value - delta, 0.12);
            var head2 = valueToPoint(value + delta, 0.12);

            var tailValue = value - (range * (1/(270/360)) / 2);
            var tail = valueToPoint(tailValue, 0.28);
            var tail1 = valueToPoint(tailValue - delta, 0.12);
            var tail2 = valueToPoint(tailValue + delta, 0.12);

            return [head, head1, tail2, tail, tail1, head2, head];

            function valueToPoint(value, factor) {
                var point = self.valueToPoint(value, factor);
                point.x -= 100;
                point.y -= 100;
                return point;
            };
        };

        this.valueToDegrees = function(value) {
            return value / range * 270 - (0 / range * 270 + 30);
        };

        this.valueToRadians = function(value) {
            return this.valueToDegrees(value) * Math.PI / 180;
        };

        this.valueToPoint = function(value, factor) {
            return {
                x: 100 - 45 * factor * Math.cos(this.valueToRadians(value)),
                y: 100 - 45 * factor * Math.sin(this.valueToRadians(value))
            }; 
        };

        //this.resize = function() {
        //update(1000);   
        //};
        this.teardown = function() {

        };

        this.getColourScale = function(){
            //hard coded colour scale for the legend

            return d3.scale.ordinal()
                .range([
                    COLOUR_RED,
                    COLOUR_AMBER,
                    COLOUR_GREEN,
                    COLOUR_OUTLIER
                ])
                .domain([
                    statusToRangeTextMap[STATUS_RED],
                    statusToRangeTextMap[STATUS_AMBER],
                    statusToRangeTextMap[STATUS_GREEN],
                    statusToRangeTextMap[STATUS_OUTLIER]
                ]);
        };
    };

}());
