<template>
  <q-btn
    icon="save"
    color="primary"
    @click="clickFn"
  >
    &nbsp;Save trajectory
    <q-dialog v-model="showDialog">
      <q-card
        style="min-width: 350px"
        :class="{'bg-grey-3':!$q.dark.isActive}"
      >
        <q-card-section>
          <div class="text-h6">
            Add trajectory
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-form>
            <q-input
              v-model="trajectoryName"
              label="Trajectory name"
              filled
              autofocus
            />
          </q-form>
        </q-card-section>

        <q-card-actions
          align="right"
        >
          <q-btn
            v-close-popup
            label="Cancel"
            flat
          />
          <q-btn
            label="Add Trajectory"
            color="primary"
            @click="addTrajectory"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-btn>
</template>

<script setup>
// imports
import { useShotsStore } from 'stores/shots'
import { ref } from 'vue'

// props
const props = defineProps({
  shot: {
    type: Object,
    mandatory: false,
    default: null
  }
})

const shotsStore = useShotsStore()
const showDialog = ref(false)
const trajectoryName = ref('')

const clickFn = () => {
  trajectoryName.value = ''
  showDialog.value = true
}

const addTrajectory = () => {
  if (props.shot) {
    shotsStore.addShot(trajectoryName.value, props.shot)
    showDialog.value = false
  }
}

</script>
