const width = 880;
const height = 820;
const margin = { top: 42, right: 36, bottom: 52, left: 60 };
const quarterNames = new Map([
  [1, "Jan-Mar"],
  [2, "Apr-Jun"],
  [3, "Jul-Sep"],
  [4, "Oct-Dec"],
]);

const metricLabels = {
  mean_brightness: "Mean brightness",
  bright_pixel_ratio: "Bright pixel ratio",
};

const formatBrightness = d3.format(".3f");
const formatPercent = d3.format(".1%");
const tooltip = d3.select("#tooltip");

const svg = d3
  .select("#chart")
  .append("svg")
  .attr("viewBox", [0, 0, width, height])
  .attr("role", "img");

const radialLayer = svg
  .append("g")
  .attr("transform", `translate(${width / 2}, ${height / 2 + 6})`);

const trendSvg = d3
  .select("#trend-chart")
  .append("svg")
  .attr("viewBox", [0, 0, 920, 320])
  .attr("role", "img");

d3.csv("data/light_Data.csv", d3.autoType).then((data) => {
  data.forEach((d) => {
    d.date = new Date(d.year, (d.quarter - 1) * 3, 1);
    d.label = `${d.quarter_label} ${d.year}`;
  });

  const years = [...new Set(data.map((d) => d.year))].sort((a, b) => a - b);
  const yearSlider = d3.select("#year-slider");
  const currentYearLabel = d3.select("#current-year");
  const playButton = d3.select("#play-button");
  const showAllButton = d3.select("#show-all-button");
  const metricSelect = d3.select("#metric-select");

  let selectedYear = years[0];
  let selectedMetric = metricSelect.property("value");
  let timer = null;
  let playing = false;
  let showingAllYears = false;

  d3.select("#stat-years").text(`${years[0]}-${years.at(-1)}`);
  d3.select("#stat-quarters").text(data.length);
  d3.select("#stat-samples").text(d3.sum(data, (d) => d.total_days_sampled));

  yearSlider.attr("min", 0).attr("max", years.length - 1).property("value", 0);
  currentYearLabel.text(selectedYear);

  const radiusScale = d3.scalePoint().domain(years).range([76, 300]);
  const sizeScale = d3
    .scaleSqrt()
    .domain(d3.extent(data, (d) => d.bright_pixel_ratio))
    .range([5, 17]);

  const colorScales = {
    mean_brightness: d3
      .scaleSequential(d3.interpolateMagma)
      .domain(d3.extent(data, (d) => d.mean_brightness)),
    bright_pixel_ratio: d3
      .scaleSequential(d3.interpolateViridis)
      .domain(d3.extent(data, (d) => d.bright_pixel_ratio)),
  };

  radialLayer
    .append("circle")
    .attr("r", 42)
    .attr("fill", "#111826")
    .attr("stroke", "#2e3d52");

  radialLayer
    .selectAll(".year-ring")
    .data(years)
    .join("circle")
    .attr("class", "year-ring")
    .attr("r", (d) => radiusScale(d))
    .attr("fill", "none")
    .attr("stroke", "#2e3d52")
    .attr("stroke-width", 1);

  radialLayer
    .selectAll(".quarter-axis")
    .data([1, 2, 3, 4])
    .join("line")
    .attr("class", "quarter-axis")
    .attr("x1", (d) => Math.cos(angleForQuarter(d)) * 56)
    .attr("y1", (d) => Math.sin(angleForQuarter(d)) * 56)
    .attr("x2", (d) => Math.cos(angleForQuarter(d)) * 338)
    .attr("y2", (d) => Math.sin(angleForQuarter(d)) * 338);

  radialLayer
    .selectAll(".quarter-label")
    .data([1, 2, 3, 4])
    .join("text")
    .attr("class", "quarter-label")
    .attr("x", (d) => Math.cos(angleForQuarter(d)) * 352)
    .attr("y", (d) => Math.sin(angleForQuarter(d)) * 352)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .text((d) => quarterNames.get(d));

  radialLayer
    .selectAll(".year-label")
    .data(years.filter((_, i) => i % 2 === 0 || i === years.length - 1))
    .join("text")
    .attr("class", "year-label")
    .attr("x", 8)
    .attr("y", (d) => -radiusScale(d) - 4)
    .text((d) => d);

  const dots = radialLayer
    .selectAll(".quarter-dot")
    .data(data, (d) => d.label)
    .join("circle")
    .attr("class", "quarter-dot")
    .attr("cx", (d) => Math.cos(angleForQuarter(d.quarter)) * radiusScale(d.year))
    .attr("cy", (d) => Math.sin(angleForQuarter(d.quarter)) * radiusScale(d.year))
    .attr("r", (d) => sizeScale(d.bright_pixel_ratio))
    .attr("fill", (d) => colorScales[selectedMetric](d[selectedMetric]))
    .attr("stroke", "#f8fafc")
    .attr("stroke-width", 1.3)
    .on("mouseenter", function (event, d) {
      d3.select(this).raise().attr("stroke-width", 4).attr("opacity", 1);
      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${d.label}</strong><br>
          Dates: ${d.start_date} to ${d.end_date}<br>
          Days sampled: ${d.total_days_sampled}<br>
          Mean brightness: ${formatBrightness(d.mean_brightness)}<br>
          Bright pixel ratio: ${formatPercent(d.bright_pixel_ratio)}
        `);
    })
    .on("mousemove", (event) => {
      tooltip.style("left", `${event.pageX + 16}px`).style("top", `${event.pageY - 18}px`);
    })
    .on("mouseleave", function () {
      d3.select(this).attr("stroke-width", 1.3);
      tooltip.style("opacity", 0);
      if (showingAllYears) {
        showAllYears();
      } else {
        render();
      }
    });

  const trend = buildTrendChart(data, selectedMetric, colorScales[selectedMetric]);

  yearSlider.on("input", function () {
    stopPlayback();
    showingAllYears = false;
    selectedYear = years[+this.value];
    render();
  });

  metricSelect.on("change", function () {
    selectedMetric = this.value;
    if (showingAllYears) {
      showAllYears();
    } else {
      render();
    }
  });

  playButton.on("click", () => {
    if (playing) {
      stopPlayback();
      return;
    }

    showingAllYears = false;
    playing = true;
    playButton.text("Pause").attr("aria-label", "Pause animation");

    if (+yearSlider.property("value") >= years.length - 1) {
      finishPlayback();
      return;
    }

    timer = d3.interval(() => {
      const currentIndex = +yearSlider.property("value");
      const nextIndex = Math.min(currentIndex + 1, years.length - 1);

      yearSlider.property("value", nextIndex);
      selectedYear = years[nextIndex];
      render();

      if (nextIndex >= years.length - 1) {
        finishPlayback();
      }
    }, 950);
  });

  showAllButton.on("click", () => {
    stopPlayback();
    selectedYear = years.at(-1);
    yearSlider.property("value", years.length - 1);
    showAllYears();
  });

  render();

  function render() {
    showingAllYears = false;
    currentYearLabel.text(selectedYear);
    d3.select("#selected-title").text(selectedYear);

    dots
      .transition()
      .duration(260)
      .attr("fill", (d) => colorScales[selectedMetric](d[selectedMetric]))
      .attr("opacity", (d) => {
        if (d.year === selectedYear) return 1;
        if (d.year < selectedYear) return 0.26;
        return 0.06;
      })
      .attr("stroke", (d) => (d.year === selectedYear ? "#ffffff" : "#6b7280"));

    radialLayer
      .selectAll(".year-ring")
      .transition()
      .duration(260)
      .attr("opacity", (d) => (d === selectedYear ? 0.9 : d < selectedYear ? 0.28 : 0.08))
      .attr("stroke-width", (d) => (d === selectedYear ? 3.5 : 1))
      .style("filter", (d) =>
        d === selectedYear ? "drop-shadow(0 0 7px rgba(244, 201, 93, 0.8))" : null
      );

    updateSeasonList(data.filter((d) => d.year === selectedYear), selectedMetric);
    updateDarkestQuarter(data.filter((d) => d.year === selectedYear), selectedMetric);
    updateLegend(colorScales[selectedMetric], metricLabels[selectedMetric], selectedMetric);
    trend.update(selectedYear, selectedMetric, colorScales[selectedMetric], false);
  }

  function showAllYears() {
    showingAllYears = true;
    selectedYear = years.at(-1);
    currentYearLabel.text(selectedYear);
    d3.select("#selected-title").text("All years");

    dots
      .transition()
      .duration(320)
      .attr("fill", (d) => colorScales[selectedMetric](d[selectedMetric]))
      .attr("opacity", 0.92)
      .attr("stroke", "#f8fafc")
      .attr("stroke-width", 1.15);

    radialLayer
      .selectAll(".year-ring")
      .transition()
      .duration(320)
      .attr("opacity", 0.42)
      .attr("stroke-width", (d) => (d === years.at(-1) ? 2.2 : 1))
      .style("filter", null);

    updateSeasonList(data.filter((d) => d.year === selectedYear), selectedMetric);
    updateDarkestQuarter(data, selectedMetric, true);
    updateLegend(colorScales[selectedMetric], metricLabels[selectedMetric], selectedMetric);
    trend.update(selectedYear, selectedMetric, colorScales[selectedMetric], true);
  }

  function stopPlayback() {
    playing = false;
    playButton.text("Play").attr("aria-label", "Play animation");
    if (timer) {
      timer.stop();
      timer = null;
    }
  }

  function finishPlayback() {
    stopPlayback();
    showAllYears();
  }

  function angleForQuarter(quarter) {
    return ((quarter - 1) * Math.PI) / 2 - Math.PI / 2;
  }
});

function updateSeasonList(rows, metric) {
  const darkest = d3.least(rows, (d) => d[metric]);
  const cards = d3
    .select("#season-list")
    .selectAll(".season-card")
    .data(rows, (d) => d.quarter);

  const cardsEnter = cards.enter().append("div").attr("class", "season-card");
  cardsEnter.append("span").attr("class", "season-name");
  cardsEnter.append("span").attr("class", "season-value");
  cardsEnter.append("span").attr("class", "season-meta");

  cards
    .merge(cardsEnter)
    .classed("is-darkest", (d) => darkest && d.quarter === darkest.quarter && d.year === darkest.year)
    .select(".season-name")
    .text((d) => d.quarter_label);

  cards
    .merge(cardsEnter)
    .select(".season-value")
    .text((d) => formatMetric(d[metric], metric));

  cards
    .merge(cardsEnter)
    .select(".season-meta")
    .text((d) => `${d.total_days_sampled} sampled days`);

  cards.exit().remove();
}

function updateDarkestQuarter(rows, metric, allYears = false) {
  const darkest = d3.least(rows, (d) => d[metric]);
  if (!darkest) return;

  const scope = allYears ? "Darkest record overall" : "Darkest quarter";
  d3.select("#darkest-quarter").html(
    `<strong>${scope}:</strong> ${darkest.quarter_label} ${darkest.year} (${formatMetric(darkest[metric], metric)})`
  );
}

function updateLegend(scale, label, metric) {
  const legendWidth = 210;
  const legendHeight = 12;
  const id = `legend-gradient-${metric}`;
  const [min, max] = scale.domain();

  const legend = d3.select("#color-legend").html("");
  const svgLegend = legend
    .append("svg")
    .attr("viewBox", [0, 0, legendWidth, 54])
    .attr("aria-label", `${label} color scale`);

  const defs = svgLegend.append("defs");
  const gradient = defs.append("linearGradient").attr("id", id);

  d3.range(0, 1.01, 0.1).forEach((t) => {
    gradient
      .append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", scale(min + t * (max - min)));
  });

  svgLegend
    .append("rect")
    .attr("x", 0)
    .attr("y", 10)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("rx", 6)
    .attr("fill", `url(#${id})`);

  svgLegend
    .append("text")
    .attr("x", 0)
    .attr("y", 42)
    .text("Lower brightness");

  svgLegend
    .append("text")
    .attr("x", 0)
    .attr("y", 53)
    .attr("class", "legend-value")
    .text(formatMetric(min, metric));

  svgLegend
    .append("text")
    .attr("x", legendWidth)
    .attr("y", 42)
    .attr("text-anchor", "end")
    .text("Higher brightness");

  svgLegend
    .append("text")
    .attr("x", legendWidth)
    .attr("y", 53)
    .attr("class", "legend-value")
    .attr("text-anchor", "end")
    .text(formatMetric(max, metric));
}

function buildTrendChart(data, metric, colorScale) {
  const innerWidth = 920 - margin.left - margin.right;
  const innerHeight = 320 - margin.top - margin.bottom;

  const chart = trendSvg
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const xScale = d3.scaleTime().domain(d3.extent(data, (d) => d.date)).range([0, innerWidth]);
  const yScale = d3.scaleLinear().range([innerHeight, 0]).nice();

  chart
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${innerHeight})`);

  chart.append("g").attr("class", "y-axis");
  chart.append("path").attr("class", "trend-line").attr("fill", "none").attr("stroke-width", 2.5);
  chart.append("g").attr("class", "trend-points");
  chart.append("text").attr("class", "axis-label y-label").attr("x", 0).attr("y", -18);

  function update(selectedYear, selectedMetric, selectedColorScale, showAll = false) {
    yScale.domain(d3.extent(data, (d) => d[selectedMetric])).nice();

    const line = d3
      .line()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d[selectedMetric]));

    chart.select(".x-axis").call(d3.axisBottom(xScale).ticks(7).tickSizeOuter(0));
    chart
      .select(".y-axis")
      .transition()
      .duration(220)
      .call(d3.axisLeft(yScale).ticks(5));

    chart.select(".y-label").text(metricLabels[selectedMetric]);

    chart
      .select(".trend-line")
      .datum(data)
      .transition()
      .duration(260)
      .attr("d", line)
      .attr("stroke", "#8ecae6");

    chart
      .select(".trend-points")
      .selectAll("circle")
      .data(data, (d) => d.label)
      .join("circle")
      .attr("cx", (d) => xScale(d.date))
      .attr("cy", (d) => yScale(d[selectedMetric]))
      .attr("r", (d) => (showAll || d.year === selectedYear ? 4.5 : 3))
      .attr("fill", (d) => selectedColorScale(d[selectedMetric]))
      .attr("stroke", (d) => (!showAll && d.year === selectedYear ? "#ffffff" : "#172033"))
      .attr("stroke-width", (d) => (!showAll && d.year === selectedYear ? 2 : 1))
      .attr("opacity", (d) => (showAll || d.year === selectedYear ? 1 : 0.45));
  }

  update(data[0].year, metric, colorScale);
  return { update };
}

function formatMetric(value, metric) {
  return metric === "bright_pixel_ratio" ? formatPercent(value) : formatBrightness(value);
}
