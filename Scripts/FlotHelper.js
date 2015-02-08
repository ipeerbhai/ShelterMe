
FlotHelper = function () {
    var FlotHelper = {};

    var X_AXIS_OPTIONS = ['categories', 'time'];
    var Y_AXIS_OPTIONS = ['passes', 'percentage'];

    // Use this to sort the dictionary of keys before displaying
    FlotHelper.SortByKey = function (array, key) {
        return array.sort(function (a, b) {
            // toString used because value can be either a string or an integer.
            // This way we don't need to care - it's as flexible as possible.
            var x = (a[key].toString()).toLowerCase();
            var y = (b[key].toString()).toLowerCase();
            return x.localeCompare(y);
        })
    };

    FlotHelper.CreateMultiSuiteChart = function (chartSelectorId, choicesSelectorId, chartData) {

        function plotAccordingToChoices(choiceContainer) {
            var data = [];

            if (choiceContainer) {
                choiceContainer.find("input:checked").each(function () {
                    var key = $(this).attr("name");
                    if (key && aggregateData[key]) {
                        data.push(aggregateData[key]);
                    }
                });
            } else {
                $.each(aggregateData, function (key, val) {
                    if (key && aggregateData[key]) {
                        data.push(aggregateData[key]);
                    }
                });
            }
            

            // This is commented because it's actually probably the wrong idea for us to sort. The way the tooltip determines
            // which data to show is based on the index of the data on the chart, and if we change that between when we take the data
            // in and when we show it we'll be indexing improperly.
            //data = sortByKey(data, 0);

            if (data.length > 0) {
                $.plot(chartSelectorId, data, chartConfig);
            }
        };

        if (chartData['Errors'] != null) {
            // Probably just want some sort of an alert that there are errors - try to render the chart anyway?
        }

        // Get data for suites and options
        var chartSuites = chartData['Suites'];
        var chartOptions = chartData['Options'];

        // Build chart data from passed parameters and options
        var aggregateData = new Object();

        // Build chart config off of passed options
        var chartConfig = {
            xaxis: {
                mode: X_AXIS_OPTIONS[chartOptions['XAxis']]
            },
            legend: { position: "se" },
            points: { show: true },
            lines: { show: true },
            grid: { hoverable: true, clickable: true }
        };

        if (Y_AXIS_OPTIONS[chartOptions['YAxis']] == 'percentage') {
            chartConfig['yaxis'] = { max: 100 };
        }

        for (var suiteIndex in chartSuites) {

            // Get unique key for this suite and initialize data
            var suite = chartSuites[suiteIndex];
            suiteKey = suite.Name === "" ? suite.Browser : suite.Name + " - " + suite.Browser;
            aggregateData[suiteKey] = { label: suiteKey, data: new Array() }

            // Build data from runs
            for (var runIndex in suite['Runs']) {
                var run = suite['Runs'][runIndex];
                var xAxis;
                if (X_AXIS_OPTIONS[chartOptions['XAxis']] === 'categories') {
                    xAxis = run['Timestamp']
                } else if (X_AXIS_OPTIONS[chartOptions['XAxis']] === 'time') {
                    var date = new Date(parseInt(run['Timestamp'].substr(6)));
                    xAxis = date.getTime();
                } else {
                    break;
                    // This should not happen. Additional options can get added as additional else ifs off of the enums.
                }

                // Build results from run based on options
                if (Y_AXIS_OPTIONS[chartOptions['YAxis']] === "percentage") {
                    var resultSum = 0;
                    for (var resultType in run['RunData']) {
                        resultSum += run['RunData'][resultType];
                    }
                    var passPerc = run['RunData']['pass'] * 100 / (resultSum);
                    aggregateData[suiteKey]['data'].push([xAxis, passPerc]);

                } else if (Y_AXIS_OPTIONS[chartOptions['YAxis']] === "passes") {
                    aggregateData[suiteKey]['data'].push([xAxis, run['RunData']['pass']]);
                }
            }
        }

        // Ensure color is the same even when series are toggled
        var i = 0;
        $.each(aggregateData, function (key, val) {
            val.color = i;
            ++i;
        });

        // Build container for options
        if (choicesSelectorId) {
            var choiceContainer = $(choicesSelectorId);
            $.each(aggregateData, function (key, val) {
                choiceContainer.append("<br/><input type='checkbox' name='" + key +
                    "' checked='checked' id='id" + key + "'></input>" +
                    "<label for='id" + key + "'>"
                    + val.label + "</label>");
            });

            choiceContainer.find("input").bind("click", function () {
                plotAccordingToChoices(choiceContainer);
            });
            plotAccordingToChoices(choiceContainer);
        }
        else {
            plotAccordingToChoices(null);
        }
        

        // Tooltip and tooltip click code

        $("<div id='tooltip'></div>").css({
            position: "absolute",
            display: "none",
            border: "1px solid #fdd",
            padding: "2px",
            "background-color": "#fee",
            opacity: 0.80
        }).appendTo("body");

        // Build the tooltip
        $(chartSelectorId).bind("plothover", function (event, pos, item) {
            if (item) {

                var x = item.datapoint[0].toFixed(2),
                    y = item.datapoint[1].toFixed(2);
                var suite = chartSuites[item.seriesIndex];
                var tooltipString = "Suite: " + suite.Name + "<br/>Browser: " + suite.Browser;
                var run = suite.Runs[item.dataIndex];
                tooltipString += "<br/>Run Name: " + run.Name;
                // Need a conditional or something here to show dates correctly. Shows up as /Date(timestamp)/ currently
                tooltipString += "<br/>Run Timestamp: " + run.Timestamp;
                for (var key in run.RunData) {
                    tooltipString += "<br/>" + key + ": " + run.RunData[key];
                }

                for (var key in run.Metadata) {
                    tooltipString += "<br/>" + key + ": " + run.Metadata[key];
                }
                tooltipString += "<br/>Click For More Info"
                $("#tooltip").html(tooltipString)
                    .css({ top: item.pageY + 5, left: item.pageX + 5 })
                    .fadeIn(200);
            } else {
                $("#tooltip").hide();
            }
        });

        // Handle clicking on the datapoints.
        $(chartSelectorId).bind("plotclick", function (event, pos, item) {
            if (item) {
                var suite = chartSuites[item.seriesIndex];
                var run = suite.Runs[item.dataIndex];
                // Currently operates off of abs URLs, probably want to modify to build ourselves.
                var url = run.Url;
                window.open(url);
            }
        });
    }


    FlotHelper.CreateSuiteProgressChart = function (chartSelectorId, chartData) {

        if (chartData['Errors'] != null) {
            // Probably just want some sort of an alert that there are errors - try to render the chart anyway?
        }

        var runs = chartData['Suite']['Runs'];

        var runPassPerc = new Array();
        var plotData = new Object();
        var prevDate = 0;
        var dateSum = 0;
        for (var runIndex = 0; runIndex < runs.length; ++runIndex) {
            var run = runs[runIndex];
            var date = run['Timestamp']; 

            if (date > prevDate && prevDate != 0) {
                dateSum += date - prevDate;
            } else if (prevDate != 0) {
                dateSum += prevDate - date;
            }
           
            var resultSum = 0;
            for (var resultType in run['RunData']) {
                if (plotData[resultType] === undefined) {
                    plotData[resultType] = { data: new Array(), stack: true, label: resultType, bars: { show: true } }
                }
                plotData[resultType]['data'].push([date/*.getTime()*/, run['RunData'][resultType]]);
                resultSum += run['RunData'][resultType];
            }
            var passPerc = run['RunData']['pass'] * 100 / (resultSum);
            runPassPerc.push([date/*.getTime()*/, passPerc]);
            prevDate = date;
        }

        var dateAvg = dateSum / runs.length;

        for (var runIndex in plotData) {
            var run = plotData[runIndex];
            run.bars.barWidth = dateAvg * 0.6;
        }

        plotData['pass']['color'] = 'green';

        var plotArray = Object.keys(plotData).map(function (key) {
            return plotData[key];
        });

        plotArray.push(
            {
                data: runPassPerc,
                yaxis: 2,
                lines: { show: true },
                points: { show: true }
            }
        );

        var chartWrapper = $(chartSelectorId);
        var plot = $.plot(chartWrapper, plotArray, { grid: { hoverable: true }, xaxes: [{ mode: "time" }], yaxes: [{}, { alignTicksWithAxis: 1, position: "right" }] });

        $("<div id='tooltip'></div>").css({
            position: "absolute",
            display: "none",
            border: "1px solid #fdd",
            padding: "2px",
            "background-color": "#fee",
            opacity: 0.80
        }).appendTo("body");

        chartWrapper.bind("plothover", function (event, pos, item) {
            if (item) {
                var x = item.datapoint[0].toFixed(2),
                    y = item.datapoint[1].toFixed(2);
                var run = runs[item.dataIndex];
                var formattedPercent = Math.round(runPassPerc[item.dataIndex][1] * 100) / 100;
                var tooltipString = "" + run['Name'] + "<br/>passes: " + run['RunData']['pass'] + "<br/>pass percentage: " + formattedPercent + "%";

                $("#tooltip").html(tooltipString)
                    .css({ top: item.pageY + 5, left: item.pageX + 5 })
                    .fadeIn(200);
            } else {
                $("#tooltip").hide();
            }
        });

    }


    return FlotHelper;
}();