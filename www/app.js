require.config({
    paths: {
        underscore: 'lib/underscore/underscore',
        jquery:     'lib/jquery/dist/jquery',
        bootstrap:  'lib/bootstrap/dist/js/bootstrap',
        contextmenu:'lib/bootstrap-contextmenu/bootstrap-contextmenu',
        moment:     'lib/moment/moment',
        angular:    'lib/angular/angular',
        ngSanitize: 'lib/angular-sanitize/angular-sanitize',
        ngAnimate:  'lib/angular-animate/angular-animate',
        'angular-moment': 'lib/angular-moment/angular-moment',
        gvapi: 'lib/gvapi/src/genevalidatorappAPI'
    },
    shim: {
        underscore: {
            exports: '_'
        },
        jquery:     {
            exports: '$'
        },
        bootstrap:  {
            deps:    ['jquery']
        },
        contextmenu: {
            deps:    ['bootstrap']
        },
        angular:    {
            exports: 'angular',
            deps:    ['jquery']
        },
        ngSanitize: {
            deps:    ['angular']
        },
        ngAnimate:  {
            deps:    ['angular']
        },
        gvapi:      {
            exports: 'GV',
            deps:    ['jquery']
        }
    },
    packages:[{
        name:     'dojo',
        location: 'lib/dojo'
    },
    {
        name:     'dijit',
        location: 'lib/dijit'
    },
    {
        name:     'dojox',
        location: 'lib/dojox'
    },
    {
        name:     'jszlib',
        location: 'lib/jszlib'
    },
    {
        name:     'dgrid',
        location: 'lib/dgrid'
    },
    {
        name:     'xstyle',
        location: 'lib/xstyle'
    },
    {
        name:     'put-selector',
        location: 'lib/put-selector'
    },
    {
        name:     'FileSaver',
        location: 'lib/FileSaver'
    },
    {
        name:     'jDataView',
        location: 'lib/jDataView/src',
        main:     'jdataview'
    },
    {
        name:     'jqueryui',
        location: 'lib/jquery.ui/ui'
    }],
    map: {
        '*': {
            'less': 'lib/require-less/less',
            'html': 'lib/requirejs-text/text'
        }
    }
});

require(
    [
        'underscore',
        'jquery',
        'angular',
        'dojo/has',
        'dojo/_base/sniff',
        'bootstrap',
        'ngSanitize',
        'ngAnimate',
        'angular-moment',
        'less!styles'
    ],
    function (_, $, angular, has) {

        'use strict';

        var app = angular.module('app', ['ngSanitize', 'ngAnimate', 'angularMoment']);

        app.config(['$httpProvider'
        , function (http_provider) {

            http_provider.interceptors.push(['$q', '$rootScope'
            , function (q, root_scope) {

                return {
                    responseError: function (response) {
                        var status = response.status;
                        switch (status)
                        {
                            case 401:
                                root_scope.view_login();
                                return q.reject(response);
                            default:
                                return q.reject(response);
                        };
                    }
                };
            }]);
        }]);

        app.config(['$locationProvider'
        , function (location_provider) {

            location_provider.html5Mode(true).hashPrefix('!');
        }])

        app.run(['$http', '$location', '$rootScope', '$injector', '$compile'
        , function (http, location, root_scope, injector, compile) {

            if (!has('chrome')) {
                root_scope.not_chrome = true;
            }

            root_scope.view = function (path) {
                var view  = $('.content');
                var scope = view.scope();
                var files = [
                    'html!templates/' + path + '.html',
                    'controllers/'    + path,
                    'less!styles'     // Yeah, we load one and the same style sheet
                                      // for all the views.  A style sheet per view
                                      // just doesn't work.
                ];

                $('#spinner').modal();
                require(files
                , function (template, controller) {

                    scope.$apply(function () {
                        view.html(template);
                        compile(view.contents())(scope);
                        injector.invoke(controller, scope);
                    });
                    $('#spinner').modal('hide');
                });
            };

            root_scope.view_current = function () {
                var path = location.path().split('/')[1];
                if (!path) {
                    path = 'dashboard';
                }
                root_scope.view(path);
            };

            root_scope.view_login = function () {
                root_scope.view('about');
            };

            root_scope.signin_em = function () {
                var name = $('.login2 input[name="name"]').val();
                var email = $('.login2 input[name="email"]').val();

                if (name !== '' && email !== '') {
                    http.post('/signin', JSON.stringify({
                        name: name,
                        email: email,
                        picture:  '',
                        authorization: ''
                    }))
                    .then(function (response) {
                        root_scope.user = response.data;
                        location.search('login2', null);
                        root_scope.view_current();
                    });
                    return true;
                }
                return false;
            };

            root_scope.signin_fb = function () {
                FB.login(function (response) {
                    if (response.status === 'connected') {
                        var uid = response.authResponse.userID;
                        var signedRequest = response.authResponse.signedRequest;

                        // get user details
                        FB.api('/' + uid, function (response) {
                            // post to our server who accessed
                            http.post('/signin', JSON.stringify({
                                name:          response.name,
                                email:         response.email,
                                picture:       "http://graph.facebook.com/" + uid + "/picture?type=large",
                                authorization: signedRequest
                            }))
                            .then(function (response) {
                                root_scope.user = response.data;
                                root_scope.view_current();
                            });
                        });
                    }
                    else {
                        $('.login-error').show();
                    }
                }, { scope: 'email' });
            };

            root_scope.signout = function () {
                http.post('signout').
                    then(function () {
                    root_scope.user = undefined;
                    $('#logout').modal('hide');
                    root_scope.view_login();
                });
            };

            root_scope.$on('$locationChangeSuccess'
            , function (event, next, prev) {

                var n = next.split('/').pop().split(/[#?]/);
                var p = prev.split('/').pop().split(/[#?]/);

                http.get('whoami')
                .then(function (response) {
                    var user = response.data;
                    if (!user) {
                        return;
                    }
                    root_scope.user = user;

                    if (n[0] == p[0] && n[1] == p[1] && n[2] != p[2]) {
                        root_scope.$broadcast('$paramsChange', n[2], p[2]);
                        return;
                    }

                    if (n[0] == p[0] && n[1] != p[1]) {
                        root_scope.$broadcast('$hashChange', n[1], p[1]);
                        return;
                    }

                    root_scope.view_current();
                });
            });
        }]);

        angular.bootstrap(document, [app['name']]);
    });
