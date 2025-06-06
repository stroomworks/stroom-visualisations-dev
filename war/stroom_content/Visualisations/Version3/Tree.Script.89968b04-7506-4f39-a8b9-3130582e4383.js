/*
 * Copyright 2024 Crown Copyright
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

if (!visualisations) {
  var visualisations = {};
}

(function (){

  const ROOT_LITERAL= "__root";
  var d3 = window.d3;
  var commonFunctions = visualisations.commonFunctions;
  var commonConstants = visualisations.commonConstants;
  var margins = commonConstants.margins();

  visualisations.Tree = function(containerNode) {

    var initialised = false;

    if (containerNode){
      var element = containerNode;
    } else {
      var element = window.document.createElement("div");
    }
    this.element = element;

    var grid = new visualisations.GenericGrid(this.element);

    //Called by GenericGrid to create a new instance of the visualisation for each cell.
    this.getInstance = function(containerNode) {
      return new visualisations.Tree(containerNode);
    };

    const NORTH_ORIENTATION = "north";
    const SOUTH_ORIENTATION = "south";
    const EAST_ORIENTATION = "east";
    const WEST_ORIENTATION = "west";

    const treePathIndex = 0;
    const treeValueIndex = 1;
    const treeColourIndex = 2;
    var width;
    var height;
    var delimiter = '/'; // default delimiter
    var baseColor = d3.rgb(0, 139, 139);
    var color = commonConstants.categoryGoogle();
    var visSettings;
    var svgGroup;
    var canvas;
    var zoom;
    var tip;
    var treeLayout;
    var dataArea;
    var visData;
    var drawDepth = 2; // default drawDepth
    var invisibleBackgroundRect;
    var orientation = NORTH_ORIENTATION; // default Orientation
    var firstTime = true;
    var lastOrientation = NORTH_ORIENTATION;
    const rectWidth = 200;
    const rectHeight = 30;
    const transitionDuration = commonConstants.transitionDuration; 
    var currentNodes = {};
    var baseColorDomain = d3.scale.linear().range([baseColor, "black"]).domain([1,15]);

    var maxDepth = 0;

    var style = `
                .Tree-node {
                  width: 100px;
                  height: 15px;
                  color: white;
                  overflow: hidden;
                  text-rendering: geometricPrecision;
                  text-overflow: ellipsis;
                  word-wrap: break-word;
                }
                .Tree-link {
                  fill: none;
                  stroke: var(--text-color);
                } 
                .Tree {
                  pointer-events: all;
                }
                .Tree-circle {
                  fill: white;
                  stroke-width: 3;
                }
                .Tree-rect {
                  fill: white;
                  stroke-width: 3;
                  width: ${rectWidth}px;
                  height: ${rectHeight}px;
                  rx: 5px;
                  ry: 5px;
                } 
                .Tree-tip {
                  position: absolute;
                  font-size: 15px;
                  fill: red;
                  text-rendering: geometricPrecision;
                  background-color: rgba(255,255,255,0.6);
                  z-index:300;
                }`;

    // var svg = d3.select(element).append("svg:svg")
    //               .attr("class", "Tree");

    //one off initialisation of all the local variables, including
    //appending various static dom elements
    var initialise = function(settings) {
      initialised = true;

      d3.select(element).append("style").text(style);

      width = commonFunctions.gridAwareWidthFunc(true, containerNode, element);
      height = commonFunctions.gridAwareHeightFunc(true, containerNode, element);

      canvas = d3.select(element).append("svg:svg");

      const basesvg = canvas.append("svg:g");

      dataArea = basesvg.append("svg:g").attr("transform", "translate(0,0)");

     
      zoom = d3.behavior.zoom().scaleExtent([0.1, 10]).on("zoom", zoomed);
   
      basesvg.call(zoom);

      //This (invisible) rect ensures there's always a target for the zoom action
      invisibleBackgroundRect = dataArea.append("svg:rect").attr("width", width*2)
        .attr("height", height*2).attr('fill', 'white')
        .attr("transform", "translate(-" + width/2 + " -" + height/2 + ")")
        .attr("opacity", "0.0");

      svgGroup = dataArea.append("svg:g");
      
      initialiseTip(settings);
    }

    function zoomed(e) {
      dataArea.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
    }

    this.setData = function(context, settings, data) {
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
      
        //Get grid to construct the grid cells and for each one call back into a
        //new instance of this to build the visualisation in the cell
        //The last array arg allows you to synchronise the scales of fields
        grid.buildGrid(context, settings, data, this, commonConstants.transitionDuration, synchedFields);        
        this.resize;
      }
    }

    //called by Stroom to instruct the visualisation to redraw itself in a resized container
    this.resize = function() {
      commonFunctions.resize(grid, update, element, margins, width, height);
    };

    //Public entry point for the Grid to call back in to set the cell level data on the cell level
    //visualisation instance.
    //data will only contain the branch of the tree for this cell
    this.setDataInsideGrid = function(context, settings, data) {
      if (!initialised){
        initialise(settings);
      }

      visSettings = settings;

      if (settings.delimiter) {
        delimiter = settings.delimiter;
      }

      if (settings.baseColor) {
        baseColor = d3.rgb(settings.baseColor);
      }   
      
      if (settings.orientation) {
        orientation = settings.orientation;
      }

      if (settings.drawDepth) {
        drawDepth = settings.drawDepth;
      }

      // if (settings.orientation === NORTH_ORIENTATION) {
      //   svgGroup.attr("transform", `translate(${width / 2}, 0)`);
      // } else if (settings.orientation === SOUTH_ORIENTATION) {
      //   svgGroup.attr("transform", `translate(-${width / 2}, ${height})`);
      // } else if (settings.orientation === EAST_ORIENTATION) {
      //   svgGroup.attr("transform", `translate(0, ${height / 2})`);
      // } else if (settings.orientation === WEST_ORIENTATION) {
      //   svgGroup.attr("transform", `translate(${width}, ${height / 2})`);
      // }

      if (data) {
        maxDepth = 1;
        const hierarchy = buildHierarchy(data.values[0].values); //Only one series is supported
        visData = hierarchy;  
        
        if (settings.gradient == "False"){
          baseColorDomain = d3.scale.linear().range([baseColor, baseColor]).domain([1,maxDepth+3]);
        }
        else{
          baseColorDomain = d3.scale.linear().range([baseColor, "black"]).domain([1,maxDepth+3]);
        }
        update(hierarchy);
      }
    };

    function initialiseTip(settings){
      inverseHighlight = commonFunctions.inverseHighlight();

      inverseHighlight.toSelectionItem = function(d) {
        const path = d.id.substring(ROOT_LITERAL.length);
        const valuePropName = settings.valueName ? settings.valueName : "Value";
        var selection = {
          key: path,
          path: path,
          name: d.name,
          value: d.value,
        };
        selection[valuePropName] = d.value;
        return selection;
      };

      tip = inverseHighlight.tip()
          .html(function(tipData) {
              var html = inverseHighlight.htmlBuilder()
                  .addTipEntry("Name",commonFunctions.autoFormat(tipData.values.name, visSettings.nameDateFormat))
                  .addTipEntry(settings.valueName ? settings.valueName : "Value",commonFunctions.autoFormat(tipData.values.value, visSettings.nameDateFormat))
                  .build();
              return html;
          });
    }

    function update(data) {      

      const width = commonFunctions.gridAwareWidthFunc(true, containerNode, element, margins);
      const height = commonFunctions.gridAwareHeightFunc(true, containerNode, element, margins);
  
      svgGroup.attr("width", width).attr("height", height);
      
      svgGroup.call(tip);

      invisibleBackgroundRect.attr("width", width*2).attr("height", height*2)
        .attr("transform", "translate(-" + width/2 + " -" + height/2 + ")");
  
      var nodeSize = [rectWidth + 50, rectHeight + 50];

        if ((orientation === EAST_ORIENTATION || orientation === WEST_ORIENTATION)){
          nodeSize = [rectHeight + 50, rectWidth + 50];
        }

      treeLayout = d3.layout.tree().nodeSize(nodeSize)
        
      const nodes = treeLayout.nodes(data);
      const links = treeLayout.links(nodes);
  
  

      updateLinks(links);
      updateNodes(nodes);

      commonFunctions.addDelegateEvent(svgGroup, "mouseover", "rect", inverseHighlight.makeInverseHighlightMouseOverHandler(null, visData.types, svgGroup, "rect"));
      commonFunctions.addDelegateEvent(svgGroup, "mouseout", "rect", inverseHighlight.makeInverseHighlightMouseOutHandler(svgGroup, "rect"));
      commonFunctions.addDelegateEvent(svgGroup, "click","rect", inverseHighlight.makeInverseHighlightMouseClickHandler(svgGroup, "rect"));

      //as this vis has click and scroll functionality, don't add these tip click handlers
      // commonFunctions.addDelegateEvent(svg, "mousewheel", "circle", inverseHighlight.makeInverseHighlightMouseOutHandler(svg, "circle"));
      // commonFunctions.addDelegateEvent(svg, "mousedown", "circle", inverseHighlight.makeInverseHighlightMouseOutHandler(svg, "circle"));

      if (firstTime || lastOrientation !== orientation) {
        lastOrientation = orientation;
        firstTime = false;

        const xMin = d3.min(nodes, d => d.x);
        const xMax = d3.max(nodes, d => d.x) + rectWidth;
        const yMin = d3.min(nodes, d => d.y) - rectHeight;
        const yMax = d3.max(nodes, d => d.y) + rectHeight;
        if (orientation === NORTH_ORIENTATION) {
          canvas.attr("viewBox", `${xMin  - rectWidth} ${yMin - rectHeight} ${xMax - xMin + rectWidth} ${yMax - yMin + rectHeight}`);  
        } else if (orientation === SOUTH_ORIENTATION) {
          canvas.attr("viewBox", `${xMin  - rectWidth} ${- yMax - rectHeight} ${xMax - xMin + rectWidth} ${yMax - yMin + rectHeight}`);  
        } else if (orientation === EAST_ORIENTATION) { 
          canvas.attr("viewBox", `${yMin + rectWidth} ${xMin - rectHeight} ${yMax - yMin + rectWidth} ${xMax - xMin + rectHeight}`);  
        } else if (orientation === WEST_ORIENTATION) { 
          canvas.attr("viewBox", `${ - yMax + rectWidth} ${xMin - rectHeight} ${yMax - yMin + rectWidth} ${xMax - xMin + rectHeight}`);  
        }
        
      }
      
      // Stash the old positions for transition.
      nodes.forEach(function (d) {
          d.x0 = d.x;
          d.y0 = d.y;
      });



    }

    function buildHierarchy(values) {

      var root = { id: ROOT_LITERAL, children: [], _children: [] };
      var all = { ROOT_LITERAL: root };
  
      values.forEach(function(value) {
          var path = value[treePathIndex];
          var userVal = value[treeValueIndex];
          var colour = value[treeColourIndex];

          if (path.startsWith(delimiter)) {
            path = path.substring(1);
          }
          var parts = path.split(delimiter);
          var current = root;
          var fullPath = ROOT_LITERAL;
          var parent = null;

          parts.forEach(function(part, index) {
              fullPath = fullPath ? fullPath + delimiter + part : part;
              const depth = index;
              if (depth > maxDepth){
                maxDepth = depth;
              }
              var isLeaf = false;
              if (depth == parts.length - 1){
                isLeaf = true;
              }
              if (!all[fullPath]) {
                  all[fullPath] = {
                    depth: depth,
                    id: fullPath, 
                    name: part,
                    parent: parent? all[parent] : undefined,
                    value: isLeaf ? userVal : undefined,
                    colour: isLeaf ? colour : undefined,
                    children: [], 
                    _children: [] 
                  };
                  current._children.push(all[fullPath]);
                  
                  if (currentNodes[current.id] && currentNodes[fullPath]){
                    //Both the node and the child currently exist
                    const existingParent = currentNodes[current.id];
                    const existingChild = currentNodes[fullPath];

                    if (existingParent.children && existingParent.children.includes(existingChild)){ 
                      //Ensure the child stays visible (expanded) if it has been expanded
                      //Make any children visible that have been expanded
                      current.children.push(all[fullPath]); 
                    }
                  } else if (index < drawDepth) {
                    //A new node, should be visible by default if inside the draw depth
                    current.children.push(all[fullPath]);
                  }

                  parent = fullPath;
                  
              }
  
              current = all[fullPath];
          });
      });
  
      currentNodes = all;

      return root;
    }
    
    function updateNodes(nodes) {
      
      // svgGroup.selectAll('.Tree-node').remove();

      const node = svgGroup.selectAll(".Tree-node").data(nodes, d => d.id);

      
      const radius = 25;
      const fontSize = 12;
  
      const nodeEnter = node.enter().append("g")
          .attr("class", "Tree-node")
          .attr("transform",  (d) => {
            var currentNode = findCurrentNode(d);
            if (!currentNode.parent) {
              return;
            }
            if (orientation === NORTH_ORIENTATION || orientation === SOUTH_ORIENTATION) {
              if (currentNode.parent.x0) {
                return "translate(" + currentNode.parent.x0 + "," + currentNode.parent.y0 + ")";
              } else if (currentNode.parent.x) {
                return "translate(" + currentNode.parent.x + "," + currentNode.parent.y + ")";
              } else {
                return;
              }
              
            } else if (currentNode.parent.x0) {
              return "translate(" + currentNode.parent.y0 + "," + currentNode.parent.x0 + ")";
            } else if (currentNode.parent.x) {
              return "translate(" + currentNode.parent.y + "," + currentNode.parent.x + ")";
            } else {
              return;
            }
            
          })
          .style("opacity", 1.0);
  
      nodeEnter.filter(d => { return (d.id === ROOT_LITERAL)})
          .append("circle")
          .attr("r", "5")
          .style("stroke-width", 3)
          .style("fill", "darkgray");

      nodeEnter.filter(d => { return (d.id != ROOT_LITERAL)})
          .append("rect")
          .attr("class", "Tree-rect")
          .attr("transform", `translate(-${rectWidth / 2}, -15)`)
          .style("stroke-width", 2)
          .style("fill", function(d) {
            if (d.colour) {
              return d3.rgb(d.colour);
            }
            return baseColorDomain(d.depth);
          })
          .style("stroke", function(d) {
              if (!d._children || d._children.length == 0) {
                return baseColor.brighter();
              }    
              return baseColorDomain(d.depth);})
          .style("stroke-width", function(d) {
                if (!d._children || d._children.length == 0) {
                  return 2;
                }    
                return 1;})
          .on("click", nodeClick);
          
  
      nodeEnter.filter(d => { return (d.id != ROOT_LITERAL)})
          .append("text")
          .attr("class", "Tree-label")
          .attr("dy", 4) // Vertically center text
          .attr("text-anchor", "middle")
          .style("pointer-events", "none")
          .style("font-size", fontSize + "px")
          .attr("lengthAdjust", "spacingAndGlyphs")
          .attr("textLength", (d) => {
            if (!d.name){
              return undefined;
            }
            const text = d.value ? `${d.name}: ${d.value}` : d.name;
            if (text.length < 20) {
              return undefined;
            } else {
              return rectWidth - 30;
            }
            })
          .style("fill", (d) => {
            return commonFunctions.isLightColor(d.colour) ? "black" : "white";
          })
          .text((d) => {
            if (!d.name) {
              return "Unknown";
            }
            return (d.value ? `${d.name}: ${d.value}` : d.name);
          });
  
      node.transition().duration(transitionDuration)
          .attr("transform", d => {
              const position = calculateNodePosition(d);
              return position;
          });

      node.exit().transition().duration(transitionDuration).style("opacity", 0).remove();

       // Transition exiting nodes to the parent's new position.
        // var nodeExit = node.exit().transition()
        //   .duration(duration).attr("transform", function (d) {
        //     if (d.parent) {
        //       return "translate(" + parent.x + "," + parent.y + ")";
        //     }
        //   }).remove();

    }  
  
    
    function calculateNodePosition(d) {
        let x, y;
        switch (orientation) {
            case NORTH_ORIENTATION:
              x = d.x;
              y = d.y;
              break;
            case SOUTH_ORIENTATION:
              x = d.x;
              y = -d.y;
              break;
            case EAST_ORIENTATION:
              x = d.y;
              y = d.x;
                break;
            case WEST_ORIENTATION:
              x = -d.y;
              y = d.x;
              break;
        }
        return `translate(${x},${y})`;
    }
    
    function updateLinks(links) {

        const link = svgGroup.selectAll(".Tree-link").data(links, d => d.source.id + d.target.id);
    
        // link.enter().append("path")
        // .attr("class", "Tree-link")
        // .style("stroke-width", 1)  // Fixed stroke width for lines
        // .attr("d", d => calculateDiagonal(d, xScale, yScale, xOffset, yOffset));

        link.enter().append("path")
            .attr("class", "Tree-link")
            .style("stroke-width", 1)  // Fixed stroke width for lines
            .attr("d", (d) => { 
              const o = {
                x: d.source.x0 ? d.source.x0 : d.source.x,
                y: d.source.y0 ? d.source.y0 : d.source.y
              };
              

                return calculateDiagonal({source: o, target: o});
                

            });
    
        link.transition().duration(transitionDuration)
            .attr("d", d => calculateDiagonal(d));
    
        link.exit().transition().duration(500).style("opacity", 0).remove();
    }


    
    function calculateDiagonal(d) {
      let sourceX, sourceY, targetX, targetY, midX, midY;
      switch (orientation) {
          case NORTH_ORIENTATION:
              sourceX = d.source.x; 
              sourceY = d.source.y; 
              targetX = d.target.x; 
              targetY = d.target.y; 
              break;
          case SOUTH_ORIENTATION:
              sourceX = d.source.x; 
              sourceY = -d.source.y;
              targetX = d.target.x; 
              targetY = -d.target.y;
              break;
          case EAST_ORIENTATION:
              sourceX = d.source.y;
              sourceY = d.source.x; 
              targetX = d.target.y; 
              targetY = d.target.x;
              break;
          case WEST_ORIENTATION:
              sourceX = -d.source.y; 
              sourceY = d.source.x;
              targetX = -d.target.y; 
              targetY = d.target.x; 
              break;
      }

      // Calculate the midpoint
      midX = (sourceX + targetX) / 2;
      midY = (sourceY + targetY) / 2;

      switch (orientation) {
          case NORTH_ORIENTATION:
          case SOUTH_ORIENTATION:
              return `M${sourceX},${sourceY}L${sourceX},${midY}L${targetX},${midY}L${targetX},${targetY}`;
          case EAST_ORIENTATION:
          case WEST_ORIENTATION:
              return `M${sourceX},${sourceY}L${midX},${sourceY}L${midX},${targetY}L${targetX},${targetY}`;
      }
    }

    function findCurrentNode(d){
      const currentNode = currentNodes[d.id];

      if (!currentNode) {
        console.log(`WARN: Node ${d.id} is no longer available`);
        return d;
      }

      return currentNode;
    }

    function nodeClick(d) {
      if (!d3.event.ctrlKey){
        const currentNode = findCurrentNode(d);

        if (currentNode.children) {
          currentNode.children = null;
          d.children = null;
      } else {
          currentNode.children = currentNode._children;
          d.children = currentNode._children;
      }

        update(visData);
      }
    }
    
    this.getColourScale = function(){
      return color;
    };
  };

}());
