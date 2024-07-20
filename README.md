<a href="https://codepen.io/romshark/pen/poXJxre">
    <img src="https://img.shields.io/badge/live-demo-green" alt="GoDoc">
</a>

# [WebComponent](https://developer.mozilla.org/en-US/docs/Web/API/Web_components): `<component-carousel>`

A draggable, switchable media carousel component implemented as
a [custom element](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements).

## Attributes

- `index` (dynamic) is equivalent to calling immediately after initialization:

  ```js
  goTo(index, { instant: true, thumbnailsScrollBehavior: "instant" });
  ```

- `loop` (dynamic) enables looping when set
  (moving from last to first index and vice-versa).
- `drag` (dynamic) enables dragging by mouse/touch.
- `drag-threshold` (dynamic) defines after what number of pixels the method `moveBy`
  should trigger. If the drag doesn't exceed this threshold the carousel
  remains on the same index.
- `key-back` (dynamic) defines what keyboard key triggers `moveBy(-1)`
  (event listener is set on `window`).
- `key-forth` (dynamic) defines what keyboard key triggers `moveBy(1)`
  (event listener is set on `window`).

## Getters

- `length` returns the number of items in the `original` slot of the carousel.

## Methods

- `moveBy(delta: number)` moves from the current index by delta.
  For example -1 means move to the previous index. If either -(delta) or
  delta is > `length` then moveBy does nothing and returns.
- `goTo(index, options)` moves to the given index. No-op if index is out of bound.
  Parameters are accepted as:

  ```js
  {
    index: number,
    options: {
        instant?: boolean,
        thumbnailsScrollBehavior?: ScrollBehavior
    }
  }
  ```
