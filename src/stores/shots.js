import { defineStore } from 'pinia'

export const useShotsStore = defineStore('shots', {
  state: () => ({
    shotsArray: [],
    nextId: 0
  }),

  getters: {
    shotById: (state) => (id) => {
      return state.shotsArray.find(shot => shot.id === id)
    }
  },

  actions: {
    addShot (name, shot) {
      this.shotsArray.push({
        name,
        shot,
        id: this.nextId
      })
      this.nextId++
    },
    removeShot (id) {
      const index = this.shotsArray.findIndex(shot => shot.id === id)
      if (index !== -1) {
        this.shotsArray.splice(index, 1)
      }
    }
  },
  persist: true
})
