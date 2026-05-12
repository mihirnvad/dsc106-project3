d3.csv("data/light_Data.csv", d3.autoType).then(data => {
    console.log(data);
});

const width = 800;
const height = 800;

const svg = d3
  .select("#chart")
  .append("svg")
  .attr("viewBox", [0, 0, width, height])
  .attr("width", "800")
  .attr("height", "800");

const g = svg
  .append("g")
  .attr("transform", `translate(${width / 2}, ${height / 2})`);

const tooltip = d3.select("#tooltip");

d3.csv("data/light_Data.csv", d3.autoType).then(data => {
  console.log(data);

  const years = [...new Set(data.map(d => d.year))].sort((a, b) => a - b);

  const yearSlider = d3.select("#year-slider");
  const currentYearLabel = d3.select("#current-year");
  const playButton = d3.select("#play-button");
  
  yearSlider
    .attr("min", 0)
    .attr("max", years.length - 1)
    .attr("step", 1)
    .attr("value", 0);

  currentYearLabel.text(years[0]);

  const radiusScale = d3
    .scalePoint()
    .domain(years)
    .range([80, 340]);

  const angleScale = d3
    .scaleLinear()
    .domain([1, 5])
    .range([0, 2 * Math.PI]);

  const colorScale = d3
    .scaleSequential()
    .domain(d3.extent(data, d => d.mean_brightness))
    .interpolator(d3.interpolateInferno);

  const sizeScale = d3
    .scaleSqrt()
    .domain(d3.extent(data, d => d.bright_pixel_ratio))
    .range([5, 18]);

  // Draw year rings
  g.selectAll(".year-ring")
    .data(years)
    .join("circle")
    .attr("class", "year-ring")
    .attr("r", d => radiusScale(d))
    .attr("fill", "none")
    .attr("stroke", "#ddd")
    .attr("stroke-width", 1);

  // Draw dots
const dots = g.selectAll(".quarter-dot")
  .data(data)
  .join("circle")
  .attr("class", "quarter-dot")
  .attr("cx", d => {
    const angle = angleScale(d.quarter) - Math.PI / 2;
    return Math.cos(angle) * radiusScale(d.year);
  })
  .attr("cy", d => {
    const angle = angleScale(d.quarter) - Math.PI / 2;
    return Math.sin(angle) * radiusScale(d.year);
  })
  .attr("r", d => sizeScale(d.bright_pixel_ratio))
  .attr("fill", d => colorScale(d.mean_brightness))
  .attr("stroke", "white")
  .attr("stroke-width", 1.2)
  .attr("opacity", 0.9)
  .on("mouseover", function(event, d) {
    d3.select(this)
      .attr("stroke-width", 4)
      .attr("opacity", 1);

    tooltip
      .style("opacity", 1)
      .html(`
        <strong>${d.quarter_label} ${d.year}</strong><br>
        Dates: ${d.start_date} to ${d.end_date}<br>
        Months included: ${d.months_included}<br>
        Days sampled: ${d.total_days_sampled}<br>
        Mean brightness: ${d.mean_brightness.toFixed(3)}<br>
        Bright pixel ratio: ${(d.bright_pixel_ratio * 100).toFixed(1)}%
      `);
  })
  .on("mousemove", function(event) {
    tooltip
      .style("left", `${event.pageX + 14}px`)
      .style("top", `${event.pageY - 20}px`);
  })
  .on("mouseout", function() {
    d3.select(this)
      .attr("stroke-width", 1.2)
      .attr("opacity", 0.9);

    tooltip.style("opacity", 0);
  });
  
  function updateYear(year) {
    currentYearLabel.text(year);

    dots
      .transition()
      .duration(350)
      .attr("opacity", d => {
        if (d.year === year) return 1;
        if (d.year < year) return 0.28;
        return 0.04;
      })      
      .attr("stroke-width", d => d.year === year ? 3 : 1.2)
      .attr("stroke", d => d.year === year ? "#ffffff" : "#888");

    g.selectAll(".year-ring")
      .transition()
      .duration(350)
      .attr("opacity", d => {
        if (d === year) return 0.9;
        if (d < year) return 0.22;
        return 0.04;
      })     
      .attr("stroke-width", d => d === year ? 2.5 : 1);
  }

  yearSlider.on("input", function() {
    const year = years[+this.value];
    updateYear(year);
  });
  
  let playing = false;
  let timer = null;

  playButton.on("click", function() {
    playing = !playing;

    if (playing) {
      playButton.text("Pause");

      timer = d3.interval(() => {
        let currentIndex = +yearSlider.property("value");
        let nextIndex = currentIndex + 1;

      if (nextIndex >= years.length) {
        nextIndex = 0;
      }

      yearSlider.property("value", nextIndex);
      updateYear(years[nextIndex]);
    }, 900);
  
    } else {
      playButton.text("Play");

      if (timer) {
        timer.stop();
        timer = null;
      }
    }
  });
  // Year labels
  g.selectAll(".year-label")
    .data(years)
    .join("text")
    .attr("class", "year-label")
    .attr("x", 8)
    .attr("y", d => -radiusScale(d))
    .attr("fill", "#d8d8e8")
    .attr("font-size", "11px")
    .text(d => d);
});

updateYear(years[0]);