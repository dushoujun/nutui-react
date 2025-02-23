import React, {
  useState,
  FunctionComponent,
  useEffect,
  useRef,
  TouchEvent,
  forwardRef,
  useMemo,
} from 'react'
import { DataContext } from './UserContext'
import bem from '@/utils/bem'
import classNames from 'classnames'

export type SwiperRef = {
  to: (index: number) => void
  next: () => void
  prev: () => void
}
interface SwiperProps {
  width: number | string
  height: number | string
  duration: number | string
  initPage: number | string
  autoPlay: number | string
  direction: 'horizontal' | 'vertical'
  paginationColor: string
  paginationVisible: boolean
  loop: boolean
  touchable: boolean
  isPreventDefault: boolean
  isStopPropagation: boolean
  className?: string
  style?: React.CSSProperties
  pageContent?: React.ReactNode
  onChange?: (currPage: number) => void
}

const defaultProps = {
  width: window.innerWidth,
  height: 0,
  duration: 500,
  initPage: 0,
  autoPlay: 0,
  direction: 'horizontal',
  paginationColor: '#fff',
  paginationVisible: false,
  loop: true,
  touchable: true,
  isPreventDefault: true,
  isStopPropagation: true,
  className: '',
} as SwiperProps

type Parent = {
  propSwiper: SwiperProps
  size?: number | string
}

const DISTANCE = 5
export const Swiper = React.forwardRef<
  SwiperRef,
  Partial<SwiperProps> & Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'>
>((props, ref) => {
  const propSwiper = { ...defaultProps, ...props }
  const {
    children,
    direction,
    className,
    pageContent,
    onChange,
    initPage,
    paginationColor,
    paginationVisible,
    touchable,
    isPreventDefault,
    isStopPropagation,
    autoPlay,
    ...rest
  } = propSwiper
  const container = useRef<any>(null)
  const innerRef = useRef<any>(null)
  const _swiper = useRef<any>({
    moving: false,
    autoplayTimer: null,
    width: 0,
    height: 0,
    offset: 0,
    size: 0,
  })

  const childsRefs: any = []

  const isVertical = direction === 'vertical'

  let [rect, setRect] = useState(null as DOMRect | null)
  let [active, setActive] = useState(0)
  let [width, setWidth] = useState(0)
  let [height, setHeight] = useState(0)
  let [offset, setOffset] = useState(0)
  let [ready, setReady] = useState(false)

  let size = isVertical ? height : width
  let [touch, setTouch] = useState({
    startX: 0,
    startY: 0,
    deltaX: 0,
    deltaY: 0,
    offsetX: 0,
    offsetY: 0,
    stateDirection: '',
    delta: 0,
    touchTime: 0,
  })

  const [childs, setChilds] = useState([])
  let [touchTime, setTouchTime] = useState<any>('')

  let childCount = (children as any[]).length
  for (let i = 0; i < childCount; i++) {
    childsRefs.push(useRef<any>(null))
  }
  let trackSize = childCount * Number(size)
  const getChildren = () => {
    const childs: any = []
    React.Children.toArray(children).forEach((child: any, index) => {
      if (child.type && child.type.displayName === 'NutSwiperItem') {
        childs.push(React.cloneElement(child, { ref: childsRefs[index], key: 'item_' + index }))
      }
    })
    return childs
  }
  // 父组件参数传入子组件item
  const parent: Parent = {
    propSwiper,
    size,
  }
  const minOffset = (() => {
    if (rect) {
      const base = isVertical ? rect.height : rect.width
      return base - Number(size) * childCount
    }
    return 0
  })()
  // 清除定时器
  const stopAutoPlay = () => {
    clearTimeout(_swiper.current.autoplayTimer)
    _swiper.current.autoplayTimer = null
  }
  // 定时轮播
  const autoplay = () => {
    if (propSwiper.autoPlay <= 0 || childCount <= 1) return
    stopAutoPlay()
    _swiper.current.autoplayTimer = setTimeout(() => {
      next()
      autoplay()
    }, Number(propSwiper.autoPlay))
  }
  // 重置首尾位置信息
  const resettPosition = () => {
    _swiper.current.moving = true
    if (active <= -1) {
      move({ pace: childCount })
    }
    if (active >= childCount) {
      move({ pace: -childCount })
    }
  }

  // 上一页
  const prev = () => {
    resettPosition()
    touchReset()
    requestFrame(() => {
      requestFrame(() => {
        _swiper.current.moving = false
        move({
          pace: -1,
          isEmit: true,
        })
      })
    })
  }
  // 下一页
  const next = () => {
    resettPosition()
    touchReset()
    requestFrame(() => {
      requestFrame(() => {
        _swiper.current.moving = false
        move({
          pace: 1,
          isEmit: true,
        })
      })
    })
  }
  // 前往指定页
  const to = (index: number) => {
    resettPosition()
    touchReset()

    requestFrame(() => {
      requestFrame(() => {
        _swiper.current.moving = false
        let targetIndex
        if (props.loop && childCount === index) {
          targetIndex = active === 0 ? 0 : index
        } else {
          targetIndex = index % childCount
        }
        move({
          pace: targetIndex - active,
          isEmit: true,
        })
      })
    })
  }

  // 切换方法
  const move = ({ pace = 0, offset = 0, isEmit = false, movingStatus = false }) => {
    if (childCount <= 1) return
    const targetActive = getActive(pace)
    // 父级容器偏移量
    const targetOffset = getOffset(targetActive, offset)
    // 如果循环，调整开头结尾图片位置
    if (props.loop) {
      if (Array.isArray(children) && children[0] && targetOffset !== minOffset) {
        const rightBound = targetOffset < minOffset
        childsRefs[0].current.changeOffset(rightBound ? trackSize : 0)
      }
      if (Array.isArray(children) && children[childCount - 1] && targetOffset !== 0) {
        const leftBound = targetOffset > 0
        childsRefs[childCount - 1].current.changeOffset(leftBound ? -trackSize : 0)
      }
    }
    if (isEmit && active !== targetActive) {
      props.onChange && props.onChange((targetActive + childCount) % childCount)
    }
    active = targetActive
    offset = targetOffset
    setActive(targetActive)
    setOffset(targetOffset)

    getStyle(targetOffset)
  }
  // 确定当前active 元素
  const getActive = (pace: number) => {
    if (pace) {
      let _active = active + pace
      if (props.loop) {
        return range(_active, -1, childCount)
      }
      return range(_active, 0, childCount - 1)
    }
    return active
  }
  // 计算位移
  const getOffset = (active: number, offset = 0) => {
    let currentPosition = active * Number(size)
    if (!props.loop) {
      currentPosition = Math.min(currentPosition, -minOffset)
    }
    let targetOffset = offset - currentPosition
    if (!props.loop) {
      targetOffset = range(targetOffset, minOffset, 0)
    }
    return targetOffset
  }
  // 浏览器 帧 事件
  const requestFrame = (fn: FrameRequestCallback) => {
    window.requestAnimationFrame.call(window, fn)
  }
  // 取值 方法
  const range = (num: number, min: number, max: number) => {
    return Math.min(Math.max(num, min), max)
  }

  const getDirection = (x: number, y: number) => {
    if (x > y && x > DISTANCE) return 'horizontal'
    if (y > x && y > DISTANCE) return 'vertical'
    return ''
  }
  // 重置 全部位移信息
  const touchReset = () => {
    touch.startX = 0
    touch.startY = 0
    touch.deltaX = 0
    touch.deltaY = 0
    touch.offsetX = 0
    touch.offsetY = 0
    touch.delta = 0
    touch.stateDirection = ''
    touch.touchTime = 0
  }

  // 触摸事件开始
  const touchStart = (e: TouchEvent) => {
    touchReset()
    touch.startX = e.touches[0].clientX
    touch.startY = e.touches[0].clientY
  }

  // 触摸事件移动
  const touchMove = (e: TouchEvent) => {
    touch.deltaX = e.touches[0].clientX - touch.startX
    touch.deltaY = e.touches[0].clientY - touch.startY
    touch.offsetX = Math.abs(touch.deltaX)
    touch.offsetY = Math.abs(touch.deltaY)
    touch.delta = isVertical ? touch.deltaY : touch.deltaX
    if (!touch.stateDirection) {
      touch.stateDirection = getDirection(touch.offsetX, touch.offsetY)
    }
  }
  const b = bem('swiper')
  const classes = classNames(b(''))
  const contentClass = classNames({
    [`${b('inner')}`]: true,
    [`${b('vertical')}`]: isVertical,
  })
  const getStyle = (moveOffset = offset) => {
    let target = innerRef.current
    target.style.transform = `translate3D${
      !isVertical ? `(${moveOffset}px,0,0)` : `(0,${moveOffset}px,0)`
    }`
    target.style.transitionDuration = `${_swiper.current.moving ? 0 : props.duration}ms`
    target.style[isVertical ? 'height' : 'width'] = `${Number(size) * childCount}px`
    target.style[isVertical ? 'width' : 'height'] = `${isVertical ? width : height}px`
  }

  const onTouchStart = (e: TouchEvent) => {
    if (props.isPreventDefault) e.preventDefault()
    if (props.isStopPropagation) e.stopPropagation()
    if (!props.touchable) return
    touchStart(e)
    touch.touchTime = Date.now()
    stopAutoPlay()
    resettPosition()
  }

  const onTouchMove = (e: TouchEvent) => {
    if (props.touchable && _swiper.current.moving) {
      touchMove(e)
      if (touch.stateDirection === props.direction) {
        move({
          offset: touch.delta,
        })
      }
    }
  }
  const onTouchEnd = (e: TouchEvent) => {
    if (!props.touchable || !_swiper.current.moving) return
    const speed = touch.delta / (Date.now() - touch.touchTime)
    const isShouldMove = Math.abs(speed) > 0.3 || Math.abs(touch.delta) > +(size / 2).toFixed(2)
    let pace = 0
    _swiper.current.moving = false
    if (isShouldMove && touch.stateDirection === props.direction) {
      const offset = isVertical ? touch.offsetY : touch.offsetX
      if (props.loop) {
        pace = offset > 0 ? (touch.delta > 0 ? -1 : 1) : 0
      } else {
        pace = -Math[touch.delta > 0 ? 'ceil' : 'floor'](touch.delta / size)
      }
      move({
        pace,
        isEmit: true,
      })
    } else if (touch.delta) {
      move({ pace: 0 })
    } else {
      getStyle()
    }
    autoplay()
  }

  useEffect(() => {
    _swiper.current.activePagination = (active + childCount) % childCount
  }, [active])

  const init = (active: number = +propSwiper.initPage) => {
    let rect = container.current.getBoundingClientRect()
    let _active = Math.max(Math.min(childCount - 1, active), 0)
    let _width = propSwiper.width ? +propSwiper.width : rect.width
    let _height = propSwiper.height ? +propSwiper.height : rect.height
    size = isVertical ? _height : _width
    trackSize = childCount * Number(size)
    let targetOffset = getOffset(_active)
    _swiper.current.moving = true
    if (ready) {
      _swiper.current.moving = false
    }
    setRect(rect)
    setActive(_active)
    setWidth(_width)
    setHeight(_height)
    setOffset(targetOffset)
    setReady(true)
  }
  useEffect(() => {
    if (ready) {
      getStyle()
    }
  }, [isVertical, width, height, offset, ready])
  useEffect(() => {
    if (ready) {
      stopAutoPlay()
      autoplay()
    }
    return () => {
      setReady(false)
    }
  }, [ready])

  useEffect(() => {
    setChilds(getChildren())
  }, [children])
  useEffect(() => {
    init()
  }, [propSwiper.initPage])
  useEffect(() => {
    let target = container.current
    target.addEventListener('touchstart', onTouchStart, false)
    target.addEventListener('touchmove', onTouchMove, false)
    target.addEventListener('touchend', onTouchEnd, false)
    return () => {
      target.removeEventListener('touchstart', onTouchStart, false)
      target.removeEventListener('touchmove', onTouchMove, false)
      target.removeEventListener('touchend', onTouchEnd, false)
    }
  })
  React.useImperativeHandle(ref, () => ({
    to,
    next,
    prev,
  }))
  return (
    <DataContext.Provider value={parent}>
      <div className={`${classes} ${className}`} ref={container} {...rest}>
        <div className={contentClass} ref={innerRef}>
          {childs}
        </div>
        {propSwiper.paginationVisible && !('pageContent' in propSwiper) ? (
          <div
            className={classNames({
              [`${b('pagination')}`]: true,
              [`${b('pagination-vertical')}`]: isVertical,
            })}
          >
            {childs.map((item, index) => {
              return (
                <i
                  style={{
                    backgroundColor:
                      (active + childCount) % childCount === index
                        ? propSwiper.paginationColor
                        : '#ddd',
                  }}
                  key={index}
                />
              )
            })}
          </div>
        ) : (
          <div>{pageContent}</div>
        )}
      </div>
    </DataContext.Provider>
  )
})
Swiper.defaultProps = defaultProps
Swiper.displayName = 'NutSwiper'
