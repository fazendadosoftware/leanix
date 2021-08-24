import { getAccessToken } from '@fazendadosoftware/leanix-core'

console.log(getAccessToken)
export function doSomeStuff (
  withThis: string,
  andThat: string,
  andThose: string[]
): any {
  // function on one line
  if (andThose.length === 0) {
    return false
  }
  console.log(withThis)
  console.log(andThat)
  console.dir(andThose)
}
// TODO: more examples
