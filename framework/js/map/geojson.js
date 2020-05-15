class MapGeojson extends MapAbstract {
    constructor () {
        super('.ds44-js-map[data-geojson-mode="dynamic"]');
    }

    create (element) {
        super.create(element);

        const objectIndex = (this.objects.length - 1);
        const object = this.objects[objectIndex];

        object.geojsonHoveredId = null;
    }

    afterLoadGeojson (objectIndex) {
        const object = this.objects[objectIndex];

        object.map.setFilter(this.geojsonLinesId, ['!has', 'name']);
        object.map.setFilter(this.geojsonFillsId, ['!has', 'name']);

        object.map.on('click', this.geojsonFillsId, this.showAreaPopup.bind(this, objectIndex));
        object.map.on('mousemove', this.geojsonFillsId, this.focus.bind(this, objectIndex));
        object.map.on('mouseleave', this.geojsonFillsId, this.blur.bind(this, objectIndex));

        object.isMapReady = true;
        object.isGeojsonLoaded = true;
        if (object.newResults) {
            this.show(objectIndex);
        }
    }

    showAreaPopup (objectIndex, evt) {
        if (
            evt.originalEvent &&
            evt.originalEvent.target &&
            evt.originalEvent.target.classList.contains('ds44-map-marker')
        ) {
            // Clicked on a marker
            return;
        }

        const object = this.objects[objectIndex];

        let popupContent = `
            <section class="ds44-card ds44-js-card ds44-card--contact ds44-box ds44-bgGray">
                <div class="ds44-card__section">
                    <div class="ds44-innerBoxContainer">
                        <h2 class="h4-like ds44-cardTitle mts">${evt.features[0].properties.description}</h2>
                    </div>
                </div>
            </section>
        `;
        for (let resultIndex in object.newResults) {
            if (!object.newResults.hasOwnProperty(resultIndex)) {
                continue;
            }

            const result = object.newResults[resultIndex];
            if (result.id === evt.features[0].properties.name) {
                popupContent = result.metadata.html_marker;
                break;
            }
        }

        const popup = new window.mapboxgl.Popup()
            .setLngLat(evt.lngLat)
            .setHTML(popupContent)
            .addTo(object.map);
        MiscEvent.addListener('click', this.popupClick.bind(this, evt.features[0].properties.name), popup.getElement());
    }

    show (objectIndex) {
        this.showGeojson(objectIndex);
    }

    getGeojsonIds (objectIndex) {
        const object = this.objects[objectIndex];

        // Get geojson ids
        const geojsonIds = [];
        for (let resultIndex in object.newResults) {
            if (!object.newResults.hasOwnProperty(resultIndex)) {
                continue;
            }

            const result = object.newResults[resultIndex];
            if (
                !result.metadata ||
                !result.metadata.html_marker
            ) {
                continue;
            }

            geojsonIds.push(result.id);
        }

        return geojsonIds;
    }

    focus (objectIndex, evt) {
        if (evt.features.length > 0) {
            const object = this.objects[objectIndex];

            object.map.getCanvas().style.cursor = 'pointer';

            if (object.geojsonHoveredId !== null) {
                MiscEvent.dispatch('search:blur', { 'id': object.geojsonHoveredId });
            }
            object.geojsonHoveredId = evt.features[0].properties.name;
            MiscEvent.dispatch('search:focus', { 'id': object.geojsonHoveredId });
        }
    }

    blur (objectIndex) {
        const object = this.objects[objectIndex];

        object.map.getCanvas().style.cursor = '';

        if (object.geojsonHoveredId !== null) {
            MiscEvent.dispatch('search:blur', { 'id': object.geojsonHoveredId });
            object.geojsonHoveredId = null;
        }
    }

    resultFocus (evt) {
        if (
            !evt ||
            !evt.detail ||
            !evt.detail.id
        ) {
            return;
        }

        for (let objectIndex = 0; objectIndex < this.objects.length; objectIndex++) {
            const object = this.objects[objectIndex];

            const features = object.map.querySourceFeatures(this.geojsonSourceId);
            for (let i = 0; i < features.length; i++) {
                if (features[i].properties.name === evt.detail.id) {
                    object.map.setFeatureState(
                        { source: this.geojsonSourceId, id: features[i].id },
                        { hover: true }
                    );
                }
            }
        }
    }

    resultBlur (evt) {
        if (
            !evt ||
            !evt.detail ||
            !evt.detail.id
        ) {
            return;
        }

        for (let objectIndex = 0; objectIndex < this.objects.length; objectIndex++) {
            const object = this.objects[objectIndex];

            const features = object.map.querySourceFeatures(this.geojsonSourceId);
            for (let i = 0; i < features.length; i++) {
                if (features[i].properties.name === evt.detail.id) {
                    object.map.setFeatureState(
                        { source: this.geojsonSourceId, id: features[i].id },
                        { hover: false }
                    );
                }
            }
        }
    }
}

// Singleton
new MapGeojson();
