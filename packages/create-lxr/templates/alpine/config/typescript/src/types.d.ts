import { Alpine } from 'alpinejs'

export {}

declare global {
  interface Window {
    Alpine: Alpine
  }
  interface IState {
    message: string
    counter: number
  }
  interface IMethods {
    increaseCounter: (this: IState) => void
  }
}
