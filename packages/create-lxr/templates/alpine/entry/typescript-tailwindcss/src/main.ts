import Alpine from 'alpinejs'
import 'tailwindcss/tailwind.css'
import './style.css'

window.Alpine = Alpine

const getState = (): IState => ({
  message: 'I ❤️ Alpine',
  counter: 0
})

const getMethods = (): IMethods => ({
  increaseCounter () {
    this.counter++
  }
})

Alpine.data('lxr', () => ({ ...getState(), ...getMethods() }))
Alpine.start()
