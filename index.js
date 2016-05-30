"use strict";

var path = require('path');
var fs = require('fs');
var lutils = require('loader-utils');

function getCamelName(name) {
    name = path.basename(name);
    var words = name.replace(/^((uxcore|tingle|vc)-)?(.+)/, "$3").split('-');
    return words.map(function (word) {
        return word[0].toUpperCase() + word.substring(1);
    }).join('');
}

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
        components = [];
    }

    if (components.components) {
        components = components.components;
    } else if (components.dependencies || components.devDependencies) {
        var temp = components.dependencies ? Object.keys(components.dependencies).filter(function (item) {
            return /^(@ali\/)?vc\-.+/.test(item);
        }) : [];
        components.devDependencies && Object.keys(components.devDependencies).forEach(function (item) {
            if (/^(@ali\/)?vc\-.+/.test(item) && temp.indexOf(item) < 0) {
                temp.push(item);
            }
        });
        components = temp;
    }

    if (!Array.isArray(components)) {
        return callback(null, 'module.exports = [];');
    }

    var _this = this;
    var resourcePath = path.dirname(this.resourcePath);
    var query = lutils.parseQuery(this.query);
    var resourceQuery = lutils.parseQuery(this.resourceQuery);
    var entry = resourceQuery.entry || query.entry || "main";

    function tryfiles(pkg, files, callback) {
        var fallback = files.pop();

        function stat() {
            var file = files.shift();

            if (!file) {
                return callback(fallback);
            }

            _this.resolve(resourcePath, pkg + '/' + file, function (err, filepath) {
                if (err) {
                    return stat();
                }

                callback(file);
            });
        }

        stat();
    }

    function parseInfo(index, pkg, pkgJson, info, callback) {
        var camelName = getCamelName(pkgJson.name || pkg);
        var ret = {
            name: pkgJson.name || pkg,
            componentName: info.componentName || pkgJson.componentName,
            category: info.category || pkgJson.category || null
        };
        function done(path) {
            ret.path = path;
            callback(index, ret);
        }
        if (pkgJson[entry]) {
            return done(pkgJson[entry]);
        }
        if (entry === 'prototype') {
            return tryfiles(pkg, [
                // trys
                'build/prototype.js', 'dist/prototype.js', 'lib/prototype.js',
                // fallback
                entry
            ], done);
        }
        if (entry === 'prototypeView') {
            return tryfiles(pkg, [
                // trys
                'build/prototypeView.js', 'dist/prototypeView.js', 'lib/prototypeView.js',
                'build/'+camelName+'.js', 'dist/'+camelName+'.js', 'lib/'+camelName+'.js',
                pkgJson.main || entry,
                // fallback
                null
            ], done);
        }
        if (entry === 'view') {
            return tryfiles(pkg, [
                // trys
                'build/view.js', 'dist/view.js', 'lib/view.js',
                'build/'+camelName+'.js', 'dist/'+camelName+'.js', 'lib/'+camelName+'.js',
                // fallback
                pkgJson.main || entry
            ], done);
        }
        if (entry === 'view.mobile') {
            return tryfiles(pkg, [
                // trys
                'build/view.mobile.js', 'dist/view.mobile.js', 'lib/view.mobile.js',
                'build/view.js', 'dist/view.js', 'lib/view.js',
                'build/'+camelName+'.js', 'dist/'+camelName+'.js', 'lib/'+camelName+'.js',
                // fallback
                pkgJson.main || entry
            ], done);
        }
        done(entry);
    }

    var completed = 0, total = components.length;

    components.forEach(function (item, index) {
        var pkg = typeof item === 'string' ? item : (item.package || item.name);
        _this.resolve(resourcePath, pkg + '/package.json', function (err, jsonpath) {
            var pkgJson = {};
            if (!err) {
                pkgJson = require(jsonpath) || {};
            }
            parseInfo(index, pkg, pkgJson, item, complete);
        });
    });

    function complete(index, ret) {
        var fields = [
            '"name": "' + ret.name + '"',
            '"module": ' + (ret.path ? ('require("'+ret.name+'/'+ret.path+'")') : 'null')
        ];
        if (ret.componentName) {
            fields.push('"componentName": "' + ret.componentName + '"');
        }
        if (ret.category) {
            fields.push('"category": "' + ret.category + '"');
        }
        components[index] = '{'+fields.join(', ')+'}';

        completed += 1;

        if (completed >= total) {
            callback(null, '"use strict";\nmodule.exports = [' + components.join(',\n') + '];');
        }
    }
};