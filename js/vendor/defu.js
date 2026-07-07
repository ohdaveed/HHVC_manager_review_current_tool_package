;(() => {
  var __defProp = Object.defineProperty
  var __getOwnPropNames = Object.getOwnPropertyNames
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor
  var __hasOwnProp = Object.prototype.hasOwnProperty
  function __accessProp(key) {
    return this[key]
  }
  var __toCommonJS = (from) => {
    var entry = (__moduleCache ??= new WeakMap()).get(from),
      desc
    if (entry) return entry
    entry = __defProp({}, '__esModule', { value: true })
    if ((from && typeof from === 'object') || typeof from === 'function') {
      for (var key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(entry, key))
          __defProp(entry, key, {
            get: __accessProp.bind(from, key),
            enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
          })
    }
    __moduleCache.set(from, entry)
    return entry
  }
  var __moduleCache
  var __returnValue = (v) => v
  function __exportSetter(name, newValue) {
    this[name] = __returnValue.bind(null, newValue)
  }
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, {
        get: all[name],
        enumerable: true,
        configurable: true,
        set: __exportSetter.bind(all, name),
      })
  }

  // node_modules/defu/dist/defu.mjs
  var exports_defu = {}
  __export(exports_defu, {
    defuFn: () => defuFn,
    defuArrayFn: () => defuArrayFn,
    defu: () => defu,
    default: () => defu,
    createDefu: () => createDefu,
  })
  function isPlainObject(value) {
    if (value === null || typeof value !== 'object') {
      return false
    }
    const prototype = Object.getPrototypeOf(value)
    if (
      prototype !== null &&
      prototype !== Object.prototype &&
      Object.getPrototypeOf(prototype) !== null
    ) {
      return false
    }
    if (Symbol.iterator in value) {
      return false
    }
    if (Symbol.toStringTag in value) {
      return Object.prototype.toString.call(value) === '[object Module]'
    }
    return true
  }
  function _defu(baseObject, defaults, namespace = '.', merger) {
    if (!isPlainObject(defaults)) {
      return _defu(baseObject, {}, namespace, merger)
    }
    const object = { ...defaults }
    for (const key of Object.keys(baseObject)) {
      if (key === '__proto__' || key === 'constructor') {
        continue
      }
      const value = baseObject[key]
      if (value === null || value === undefined) {
        continue
      }
      if (merger && merger(object, key, value, namespace)) {
        continue
      }
      if (Array.isArray(value) && Array.isArray(object[key])) {
        object[key] = [...value, ...object[key]]
      } else if (isPlainObject(value) && isPlainObject(object[key])) {
        object[key] = _defu(
          value,
          object[key],
          (namespace ? `${namespace}.` : '') + key.toString(),
          merger
        )
      } else {
        object[key] = value
      }
    }
    return object
  }
  function createDefu(merger) {
    return (...arguments_) => arguments_.reduce((p, c) => _defu(p, c, '', merger), {})
  }
  var defu = createDefu()
  var defuFn = createDefu((object, key, currentValue) => {
    if (object[key] !== undefined && typeof currentValue === 'function') {
      object[key] = currentValue(object[key])
      return true
    }
  })
  var defuArrayFn = createDefu((object, key, currentValue) => {
    if (Array.isArray(object[key]) && typeof currentValue === 'function') {
      object[key] = currentValue(object[key])
      return true
    }
  })
  if (typeof window !== 'undefined') window.defu = defu
  if (typeof globalThis !== 'undefined') globalThis.defu = defu
})()
