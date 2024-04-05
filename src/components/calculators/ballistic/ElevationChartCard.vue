<template>
  <q-card
    :class="{'bg-grey-3':!$q.dark.isActive}"
    flat
    class="q-pa-md"
  >
    <div class="row justify-between">
      <div class="col-auto">
        <div class="text-h6">
          <q-icon
            name="query_stats"
            size="lg"
            class="q-mr-sm"
          />
          Elevation chart
        </div>
      </div>
      <div class="col-auto">
        <q-toggle v-model="showAnnotations">
          Show Annotations
        </q-toggle>
      </div>
    </div>
    <ElevationShotList
      :shot="shot"
    />
    <apexchart
      ref="chart"
      type="line"
      :options="options"
      :series="series"
      height="300px"
    />
    <div class="row justify-end">
      <div class="col-auto">
        <AddTrajectoryButton
          :shot="shot"
        />
      </div>
    </div>
  </q-card>
</template>

<script setup>
// imports
import { useBallisticStore } from 'stores/ballistic'
import ElevationShotList from 'components/calculators/ballistic/ElevationShotList.vue'
import AddTrajectoryButton from 'components/trajectories/AddTrajectoryButton.vue'
import * as BC from 'js-ballistics'
import { ref, reactive, computed, watch } from 'vue'
import { colors, useQuasar } from 'quasar'

// the chart ref
const chart = ref(null)

// quasar $q
const $q = useQuasar()

// chart options
const options = reactive({
  chart: {
    id: 'elevation-chart',
    toolbar: {
      show: false
    },
    zoom: {
      enabled: false
    },
    fontFamily: 'Mallanna, sans-serif',
    background: 'transparent'
  },
  stroke: {
    curve: 'straight'
  },
  colors: [colors.getPaletteColor('primary')],
  theme: {
    mode: $q.dark.isActive ? 'dark' : 'light'
  },
  yaxis: [{
    title: {
      style: {
        fontSize: '1em'
      },
      offsetX: -10,
      text: ''
    }
  }
  ],
  xaxis: {
    title: {
      style: {
        fontSize: '1em'
      },
      offsetY: -10,
      text: ''
    }
  }
})

/*
 * Chart series (data)
 */
const series = ref([])
const buildSeries = () => {
  const data = []
  let serieName

  for (const trajectory of shot.value._trajectory) {
    const elevation = Math.round(trajectory.drop.In(ballisticStore.elevationUnit) * 10) / 10

    if (ballisticStore.elevationUnit === BC.Unit.Inch) {
      serieName = 'Elevation (IN)'
    }
    if (ballisticStore.elevationUnit === BC.Unit.Centimeter) {
      serieName = 'Elevation (CM)'
    }

    let distance = trajectory.distance.In(ballisticStore.distanceUnit)
    distance = Math.round(distance)
    data.push({
      x: distance,
      y: elevation
    })
  }

  // renew the data
  series.value = [{
    name: serieName,
    data
  }]
}

/*
 * Set options
 */
const setOptions = () => {
  let xAxisTitle, yAxisTitle
  if (ballisticStore.distanceUnit === BC.Unit.Yard) {
    // labels
    xAxisTitle = 'RANGE (YD)'
  }
  if (ballisticStore.distanceUnit === BC.Unit.Meter) {
    // labels
    xAxisTitle = 'RANGE (M)'
  }
  if (ballisticStore.elevationUnit === BC.Unit.Inch) {
    // labels
    yAxisTitle = 'ELEVATION (IN)'
  }
  if (ballisticStore.elevationUnit === BC.Unit.Centimeter) {
    // labels
    yAxisTitle = 'ELEVATION (CM)'
  }

  // set correct legend
  options.xaxis.title.text = xAxisTitle
  options.yaxis[0].title.text = yAxisTitle

  // adjust data & axis
  options.xaxis.tickAmount = ballisticStore.range.distance / ballisticStore.range.step

  if (chart.value) { // chart may be null if not mounted
    chart.value.updateOptions(options)
  }
}

/*
 * Annotations
 */
const showAnnotations = ref(false)
watch(showAnnotations, (newValue) => {
  toggleAnnotations(newValue)
})
const toggleAnnotations = (show) => {
  if (chart.value) {
    if (show) {
      chart.value.addPointAnnotation(annotationNearZero.value)
      chart.value.addPointAnnotation(annotationMaxOrdinance.value)
      if (shot.value.farZero) {
        chart.value.addPointAnnotation(annotationFarZero.value)
      }
    } else {
      chart.value.removeAnnotation(annotationNearZero.value.id)
      if (shot.value.farZero) {
        chart.value.removeAnnotation(annotationFarZero.value.id)
      }
      chart.value.removeAnnotation(annotationMaxOrdinance.value.id)
    }
  }
}

const annotationNearZero = computed(() => {
  return {
    id: 'near-zero',
    x: shot.value.nearZero.In(ballisticStore.distanceUnit),
    y: 0,
    label: {
      text: 'Near zero',
      borderColor: 'transparent',
      style: {
        background: colors.getPaletteColor('grey-9'),
        color: '#fff',
        fontSize: '15px'
      }
    },
    borderColor: colors.getPaletteColor('grey-9'),
    fillColor: colors.getPaletteColor('grey-9')
  }
})
const annotationFarZero = computed(() => {
  return {
    id: 'far-zero',
    x: shot.value.farZero.In(ballisticStore.distanceUnit),
    y: 0,
    label: {
      text: 'Far zero',
      borderColor: 'transparent',
      style: {
        background: colors.getPaletteColor('grey-9'),
        color: '#fff',
        fontSize: '15px'
      }
    },
    borderColor: colors.getPaletteColor('grey-9'),
    fillColor: colors.getPaletteColor('grey-9')
  }
})
const annotationMaxOrdinance = computed(() => {
  return {
    id: 'max-ordinance',
    x: shot.value.maxOrdinance.distance.In(ballisticStore.distanceUnit),
    y: shot.value.maxOrdinance.elevation.In(ballisticStore.elevationUnit),
    label: {
      text: 'Max. Ordinance',
      borderColor: 'transparent',
      style: {
        background: colors.getPaletteColor('grey-9'),
        color: '#fff',
        fontSize: '15px'
      }
    },
    borderColor: colors.getPaletteColor('grey-2'),
    fillColor: colors.getPaletteColor('grey-2'),
    strokeDashArray: 10
  }
})

/*
 * Calculate shot
 */
const ballisticStore = useBallisticStore()
const shot = computed(() => ballisticStore.calculateShotStep1)
const step = computed(() => ballisticStore.range.step)

watch([shot, step], () => {
  buildSeries()
  setOptions()
  // remove annotations
  showAnnotations.value = false
},
{
  deep: true,
  immediate: true
})

</script>
