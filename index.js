var path = require('path');
var fs = require('fs');
var lutils = require('loader-utils');

/**
 * @param {String} source
 */
module.exports = function (source) {
    // let webpack know about us, and get our callback
    var callback = this.async();
    this.cacheable();

    var components;
    try {
        components = JSON.parse(source.trim()) || [];
    } catch (e) {
        try {
            components = this.exec(source, this.resourcePath);
        } catch (e2) {
            components = [];
        }
    }

    if (components.components) {
        components = components.components;
    }

    if (!Array.isArray(components)) {
        return callback(null, 'module.exports = [];');
    }

    var _this = this;
    var resourcePath = this.resourcePath;
    var query = lutils.parseQuery(this.query);
    var resourceQuery = lutils.parseQuery(this.resourceQuery);
    var entry = resourceQuery.entry || query.entry || "main";

    var completed = 0, total = components.length;

    components.forEach(function (item, index) {
        var pkg = typeof item === 'string' ? item : item.package;
        _this.resolve(resourcePath, pkg + '/package.json', function (err, jsonpath) {
            var pkgJson = {};
            if (!err) {
                pkgJson = require(jsonpath) || {};
            }
            var componentName = item.componentName || pkgJson.componentName;
            var category = item.category || pkgJson.category;
            components[index] = '{"componentName": "' + componentName + '", "category": "' + category + '", "module": require("' + pkg + '/' + (pkgJson[entry] || entry) + '")}';
            complete();
        });
    });

    function complete() {
        completed += 1;

        if (completed >= total) {
            callback(null, '"use strict";\nmodule.exports = [' + components.join(',\n') + '];');
        }
    }
};