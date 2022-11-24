import Alpine from 'alpinejs'
import 'tailwindcss/tailwind.css'
import './style.css'

window.Alpine = Alpine

const getState = () => ({
  message: 'I ❤️ Alpine',
  counter: 0
})

const getMethods = () => ({
  increaseCounter () {
    this.counter++
  }
})

Alpine.data('lxr', () => ({ ...getState(), ...getMethods() }))
Alpine.start()
