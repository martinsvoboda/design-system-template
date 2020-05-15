class MapAbstract {
    constructor (selector) {
        const maps = document.querySelectorAll(selector);
        if (maps.length === 0) {
            return;
        }

        this.objects = [];
        this.isMapLanguageLoaded = false;
        this.isMapLoaded = false;
        this.isGeojsonLoaded = false;
        this.geojsonSourceId = 'geojson-source';
        this.geojsonFillsId = 'geojson-fills';
        this.geojsonLinesId = 'geojson-lines';

        maps
            .forEach((element) => {
                this.create(element);
            });
        this.initialize();
    }

    create (element) {
        const object = {
            'id': MiscUtils.generateId(),
            'mapElement': element,
            'isMapReady': false,
            'parentElement': element.closest('.ds44-mapResults'),
            'containerElement': element.closest('.ds44-mapResults-container'),
            'newResults': null,
            'zoom': false,
            'addUp': false,
            'isVisible': true,
            'isMoving': false,
            'maximumTop': null
        };
        object.mapElement.setAttribute('id', object.id);
        this.objects.push(object);
    }

    initialize () {
        MiscEvent.addListener('search:focus', this.resultFocus.bind(this));
        MiscEvent.addListener('search:blur', this.resultBlur.bind(this));

        for (let objectIndex = 0; objectIndex < this.objects.length; objectIndex++) {
            const object = this.objects[objectIndex];

            MiscEvent.addListener('search:update', this.search.bind(this, objectIndex));
            MiscEvent.addListener('resize', this.resize.bind(this, objectIndex), window);
            MiscEvent.addListener('scroll', this.scroll.bind(this, objectIndex), window);

            // Show results at startup for mobiles
            const breakpoint = window.matchMedia('(max-width: 767px)');
            if (breakpoint.matches) {
                const resultsElement = object.mapElement.closest('.ds44-results.ds44-results--mapVisible')
                if (resultsElement) {
                    this.toggleView(objectIndex);
                }
            }
        }

        if (!document.querySelector('link[href="https://api.mapbox.com/mapbox-gl-js/v1.8.1/mapbox-gl.css"]')) {
            let linkElement = document.createElement('link');
            linkElement.setAttribute('href', 'https://api.mapbox.com/mapbox-gl-js/v1.8.1/mapbox-gl.css');
            linkElement.setAttribute('rel', 'stylesheet');
            document.head.appendChild(linkElement);
        }

        if (!document.querySelector('script[src="https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-language/v0.10.1/mapbox-gl-language.js"]')) {
            let scriptElement = document.createElement('script');
            scriptElement.setAttribute('src', 'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-language/v0.10.1/mapbox-gl-language.js');
            scriptElement.setAttribute('type', 'text/javascript');
            document.head.appendChild(scriptElement);
            MiscEvent.addListener('load', this.mapLanguageScriptLoaded.bind(this), scriptElement);
        } else {
            this.mapLanguageScriptLoaded();
        }

        if (!document.querySelector('script[src="https://api.mapbox.com/mapbox-gl-js/v1.8.1/mapbox-gl.js"]')) {
            let scriptElement = document.createElement('script');
            scriptElement.setAttribute('src', 'https://api.mapbox.com/mapbox-gl-js/v1.8.1/mapbox-gl.js');
            scriptElement.setAttribute('type', 'text/javascript');
            document.head.appendChild(scriptElement);
            MiscEvent.addListener('load', this.mapScriptLoaded.bind(this), scriptElement);
        } else {
            this.mapScriptLoaded();
        }
    }

    mapLanguageScriptLoaded () {
        this.isMapLanguageLoaded = true;
        this.mapLoad();
    }

    mapScriptLoaded () {
        this.isMapLoaded = true;
        window.mapboxgl.accessToken = 'pk.eyJ1IjoiemF6aWZmaWMiLCJhIjoiY2s3bmtxYXh2MDNqZzNkdDc3NzJ0aGdqayJ9.TuhsI1ZKXwKSGw2F3bVy5g';
        this.mapLoad();
    }

    mapLoad () {
        if (
            this.isMapLanguageLoaded &&
            this.isMapLoaded
        ) {
            for (let objectIndex = 0; objectIndex < this.objects.length; objectIndex++) {
                const object = this.objects[objectIndex];

                object.map = new window.mapboxgl.Map({
                    container: object.id,
                    style: 'mapbox://styles/mapbox/streets-v11',
                    center: [-1.8157647, 47.2780468],
                    zoom: 8
                });
                object.map.on('load', this.afterLoad.bind(this, objectIndex));
            }
        }
    }

    afterLoad (objectIndex) {
        const object = this.objects[objectIndex];

        // Add geojson if included
        const geojsonUrl = object.mapElement.getAttribute('data-geojson-url');
        if (geojsonUrl) {
            MiscRequest.send(
                geojsonUrl,
                this.loadGeojson.bind(this, objectIndex),
                () => {
                    console.log('Error when loading the geojson file')
                }
            );
        }

        object.map.addControl(new window.mapboxgl.NavigationControl(), 'bottom-right');
        object.map.addControl(new window.mapboxgl.FullscreenControl(), 'bottom-left');
        object.map.addControl(new window.MapboxLanguage({ defaultLanguage: 'fr' }));
        object.map.setLayoutProperty('country-label', 'text-field', ['get', 'name_fr']);

        MiscEvent.addListener('fullscreenchange', this.translateMap.bind(this, objectIndex));
        this.translateMap(objectIndex);

        object.mapElement
            .closest('.ds44-results')
            .querySelectorAll('.ds44-js-toggle-map-view')
            .forEach((mapToggleViewElement) => {
                MiscEvent.addListener('click', this.toggleView.bind(this, objectIndex), mapToggleViewElement);
            });
    }

    loadGeojson (objectIndex, geojson) {
        if (geojson) {
            const object = this.objects[objectIndex];

            object.map.addSource(this.geojsonSourceId, {
                'type': 'geojson',
                'data': geojson,
                'generateId': true
            });
            object.map.addLayer({
                'id': this.geojsonFillsId,
                'type': 'fill',
                'source': this.geojsonSourceId,
                'paint': {
                    'fill-color': ['get', 'fill'],
                    'fill-opacity': [
                        'case',
                        ['boolean', ['feature-state', 'hover'], false],
                        0.8,
                        ['get', 'fill-opacity']
                    ]
                }
            });
            object.map.addLayer({
                'id': this.geojsonLinesId,
                'type': 'line',
                'source': this.geojsonSourceId,
                'paint': {
                    'line-color': ['get', 'stroke'],
                    'line-opacity': ['get', 'stroke-opacity'],
                    'line-width': ['get', 'stroke-width']
                }
            });

            this.afterLoadGeojson(objectIndex);
        }
    }

    afterLoadGeojson (objectIndex) {
        // Abstract method
    }

    getGeojsonIds (objectIndex) {
        // Abstract method
    }

    showGeojson (objectIndex,) {
        const object = this.objects[objectIndex];

        if (!object.isGeojsonLoaded) {
            return;
        }

        // Remove existing geojson
        if (!object.addUp) {
            object.map.setFilter(this.geojsonLinesId, ['!has', 'name']);
            object.map.setFilter(this.geojsonFillsId, ['!has', 'name']);
        }

        // Show current geojson
        const geojsonIds = [...new Set(this.getGeojsonIds(objectIndex))];
        let filterParameters = [];
        if (geojsonIds.length === 0) {
            filterParameters = ['!has', 'name'];
        } else {
            filterParameters = [
                'match',
                ['get', 'name'],
                geojsonIds,
                true,
                false
            ];
        }

        object.map.setFilter(this.geojsonFillsId, filterParameters);
        object.map.setFilter(this.geojsonLinesId, filterParameters);
    }

    translateMap (objectIndex) {
        const object = this.objects[objectIndex];

        const mapCanvasElement = object.mapElement.querySelector('.mapboxgl-canvas');
        if (mapCanvasElement) {
            mapCanvasElement.setAttribute('role', 'img');
            mapCanvasElement.setAttribute('aria-label', MiscTranslate._('MAP_CANVAS'));
        }

        const mapLogoElement = object.mapElement.querySelector('.mapboxgl-ctrl-logo');
        if (mapLogoElement) {
            mapLogoElement.removeAttribute('aria-label');
            mapLogoElement.setAttribute('title', MiscTranslate._('MAP_LOGO'));

            let spanElement = mapLogoElement.querySelector('.visually-hidden');
            if (!spanElement) {
                spanElement = document.createElement('span')
                spanElement.classList.add('visually-hidden');
                mapLogoElement.appendChild(spanElement);
            }
            spanElement.innerText = MiscTranslate._('MAP_LOGO');
        }

        const mapImproveMapElement = object.mapElement.querySelector('.mapbox-improve-map');
        if (mapImproveMapElement) {
            mapImproveMapElement.setAttribute('title', MiscTranslate._('MAP_IMPROVE_NEW_WINDOW'));
            mapImproveMapElement.innerText = MiscTranslate._('MAP_IMPROVE');

            let currentElement = mapImproveMapElement;
            while ((currentElement = MiscDom.getPreviousSibling(currentElement))) {
                currentElement.setAttribute('title', MiscTranslate._('TOS_OF') + ' ' + currentElement.innerText + ' - ' + MiscTranslate._('NEW_WINDOW'));
            }
        }

        const mapFullScreenElement = object.mapElement.querySelector('.mapboxgl-ctrl-fullscreen');
        if (mapFullScreenElement) {
            mapFullScreenElement.removeAttribute('aria-label');
            mapFullScreenElement.setAttribute('title', MiscTranslate._('MAP_FULLSCREEN'));

            let spanElement = mapFullScreenElement.querySelector('.visually-hidden');
            if (!spanElement) {
                spanElement = document.createElement('span')
                spanElement.classList.add('visually-hidden');
                mapFullScreenElement.appendChild(spanElement);
            }
            spanElement.innerText = MiscTranslate._('MAP_FULLSCREEN');
        }

        const mapShrinkElement = object.mapElement.querySelector('.mapboxgl-ctrl-shrink');
        if (mapShrinkElement) {
            mapShrinkElement.removeAttribute('aria-label');
            mapShrinkElement.setAttribute('title', MiscTranslate._('MAP_SHRINK'));

            let spanElement = mapShrinkElement.querySelector('.visually-hidden');
            if (!spanElement) {
                spanElement = document.createElement('span')
                spanElement.classList.add('visually-hidden');
                mapShrinkElement.appendChild(spanElement);
            }
            spanElement.innerText = MiscTranslate._('MAP_SHRINK');
        }

        const mapZoomInElement = object.mapElement.querySelector('.mapboxgl-ctrl-zoom-in');
        if (mapZoomInElement) {
            mapZoomInElement.removeAttribute('aria-label');
            mapZoomInElement.setAttribute('title', MiscTranslate._('MAP_ZOOM_IN'));

            let spanElement = mapZoomInElement.querySelector('.visually-hidden');
            if (!spanElement) {
                spanElement = document.createElement('span')
                spanElement.classList.add('visually-hidden');
                mapZoomInElement.appendChild(spanElement);
            }
            spanElement.innerText = MiscTranslate._('MAP_ZOOM_IN');
        }

        const mapZoomOutElement = object.mapElement.querySelector('.mapboxgl-ctrl-zoom-out');
        if (mapZoomOutElement) {
            mapZoomOutElement.removeAttribute('aria-label');
            mapZoomOutElement.setAttribute('title', MiscTranslate._('MAP_ZOOM_OUT'));

            let spanElement = mapZoomOutElement.querySelector('.visually-hidden');
            if (!spanElement) {
                spanElement = document.createElement('span')
                spanElement.classList.add('visually-hidden');
                mapZoomOutElement.appendChild(spanElement);
            }
            spanElement.innerText = MiscTranslate._('MAP_ZOOM_OUT');
        }

        const mapCompassElement = object.mapElement.querySelector('.mapboxgl-ctrl-compass');
        if (mapCompassElement) {
            mapCompassElement.removeAttribute('aria-label');
            mapCompassElement.setAttribute('title', MiscTranslate._('MAP_REORIENTATE'));

            let spanElement = mapCompassElement.querySelector('.visually-hidden');
            if (!spanElement) {
                spanElement = document.createElement('span')
                spanElement.classList.add('visually-hidden');
                mapCompassElement.appendChild(spanElement);
            }
            spanElement.innerText = MiscTranslate._('MAP_REORIENTATE');
        }
    }

    search (objectIndex, evt) {
        const object = this.objects[objectIndex];
        object.newResults = evt.detail.newResults;
        object.zoom = evt.detail.zoom;
        object.addUp = evt.detail.addUp;

        if (object.isMapReady) {
            this.show(objectIndex);
        }
    }

    show (objectIndex) {
        // Abstract method
    }

    toggleView (objectIndex) {
        const object = this.objects[objectIndex];

        const resultsElement = object.mapElement.closest('.ds44-results')
        if (resultsElement) {
            const mapToggleViewElements = resultsElement.querySelectorAll('.ds44-js-toggle-map-view');
            if (resultsElement.classList.contains('ds44-results--mapVisible')) {
                resultsElement.classList.remove('ds44-results--mapVisible')
                object.isVisible = false;

                if (object.parentElement) {
                    MiscAccessibility.hide(object.parentElement);
                }

                mapToggleViewElements.forEach((mapToggleViewElement) => {
                    const text = mapToggleViewElement.innerText.replace(MiscTranslate._('HIDE') + ' ', MiscTranslate._('SHOW') + ' ');
                    mapToggleViewElement.querySelector('span').innerHTML = text;
                    mapToggleViewElement.setAttribute('title', text);
                    if (!mapToggleViewElement.closest('.ds44-mapResults-container')) {
                        MiscAccessibility.setFocus(mapToggleViewElement);
                    }
                });
            } else {
                resultsElement.classList.add('ds44-results--mapVisible')
                object.isVisible = true;
                this.resize(objectIndex);

                if (object.parentElement) {
                    MiscAccessibility.show(object.parentElement);
                }

                mapToggleViewElements.forEach((mapToggleViewElement) => {
                    const text = mapToggleViewElement.innerText.replace(MiscTranslate._('SHOW') + ' ', MiscTranslate._('HIDE') + ' ');
                    mapToggleViewElement.querySelector('span').innerHTML = text;
                    mapToggleViewElement.setAttribute('title', text);
                    if (mapToggleViewElement.closest('.ds44-mapResults-container')) {
                        MiscAccessibility.setFocus(mapToggleViewElement);
                    }
                });
            }
        }
    }

    resize (objectIndex) {
        window.setTimeout(this.resizeMap.bind(this, objectIndex), 200);
        window.setTimeout(this.resizeMap.bind(this, objectIndex), 600);
        window.setTimeout(this.resizeMap.bind(this, objectIndex), 1000);
    }

    resizeMap (objectIndex) {
        const object = this.objects[objectIndex];

        if (object.map && object.map.resize) {
            object.map.resize();
        }

        this.scroll(objectIndex);
    }

    scroll (objectIndex) {
        const object = this.objects[objectIndex];
        const scrollTop = MiscUtils.getScrollTop();
        const enableScrolling = (object.parentElement.offsetHeight > object.containerElement.offsetHeight);

        const oldContainerElementHeight = object.containerElement.offsetHeight;
        if (enableScrolling) {
            let mapHeight = (
                Math.min(MiscUtils.getPositionY(object.parentElement) + object.parentElement.offsetHeight, (scrollTop + this.getScreenHeight())) -
                Math.max((scrollTop + MiscDom.getHeaderHeight()), MiscUtils.getPositionY(object.parentElement))
            );
            object.containerElement.style.height = mapHeight + 'px';
        } else {
            object.containerElement.style.height = null;
        }
        if (oldContainerElementHeight !== object.containerElement.offsetHeight) {
            if (object.map && object.map.resize) {
                object.map.resize();
            }
        }

        object.maximumTop = MiscUtils.getPositionY(object.parentElement) + object.parentElement.offsetHeight - object.containerElement.offsetHeight;
        const top = this.getTop(objectIndex);
        if (
            enableScrolling &&
            scrollTop > MiscUtils.getPositionY(object.parentElement) - top
        ) {
            if (!object.isMoving) {
                object.containerElement.style.width = object.parentElement.offsetWidth + 'px';
                object.isMoving = true;
            }

            if (scrollTop > this.getMaximumTop(objectIndex)) {
                object.containerElement.style.position = 'absolute';
            } else {
                object.containerElement.style.position = 'fixed';
            }
            object.containerElement.style.top = top + 'px';
        } else if (object.isMoving) {
            object.isMoving = false;

            object.containerElement.style.top = null;
            object.containerElement.style.position = 'static';
            object.containerElement.style.width = null;
        }
    }

    getScreenHeight () {
        return window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
    }

    getTop (objectIndex) {
        const object = this.objects[objectIndex];

        if (MiscUtils.getScrollTop() > this.getMaximumTop(objectIndex)) {
            return object.parentElement.offsetHeight - object.containerElement.offsetHeight;
        }

        return Math.min(this.getMaximumTop(objectIndex), MiscDom.getHeaderHeight());
    }

    getMaximumTop (objectIndex) {
        const object = this.objects[objectIndex];

        return object.maximumTop - MiscDom.getHeaderHeight();
    }

    resultFocus (evt) {
        // Abstract method
    }

    resultBlur (evt) {
        // Abstract method
    }

    popupClick (resultId, evt) {
        evt.stopPropagation();
        evt.preventDefault();

        MiscEvent.dispatch('search:select', { 'id': resultId });
    }
}
