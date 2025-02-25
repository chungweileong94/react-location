import React from 'react'

import useLocalStorage from './useLocalStorage'
import { getStatusColor, useIsMounted, useSafeState } from './utils'
import { useRouter } from 'react-location'

import {
  Panel,
  Button,
  Code,
  // Input,
  // Select,
  ActivePanel,
} from './styledComponents'
import { ThemeProvider, defaultTheme as theme } from './theme'
// import { getQueryStatusLabel, getQueryStatusColor } from './utils'
import Explorer from './Explorer'
import Logo from './Logo'

interface DevtoolsOptions {
  /**
   * Set this true if you want the dev tools to default to being open
   */
  initialIsOpen?: boolean
  /**
   * Use this to add props to the panel. For example, you can add className, style (merge and override default style), etc.
   */
  panelProps?: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >
  /**
   * Use this to add props to the close button. For example, you can add className, style (merge and override default style), onClick (extend default handler), etc.
   */
  closeButtonProps?: React.DetailedHTMLProps<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  >
  /**
   * Use this to add props to the toggle button. For example, you can add className, style (merge and override default style), onClick (extend default handler), etc.
   */
  toggleButtonProps?: React.DetailedHTMLProps<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  >
  /**
   * The position of the React Location logo to open and close the devtools panel.
   * Defaults to 'bottom-left'.
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /**
   * Use this to render the devtools inside a different type of container element for a11y purposes.
   * Any string which corresponds to a valid intrinsic JSX element is allowed.
   * Defaults to 'footer'.
   */
  containerElement?: string | any
}

interface DevtoolsPanelOptions {
  /**
   * The standard React style object used to style a component with inline styles
   */
  style?: React.CSSProperties
  /**
   * The standard React className property used to style a component with classes
   */
  className?: string
  /**
   * A boolean variable indicating whether the panel is open or closed
   */
  isOpen?: boolean
  /**
   * A function that toggles the open and close state of the panel
   */
  setIsOpen: (isOpen: boolean) => void
  /**
   * Handles the opening and closing the devtools panel
   */
  handleDragStart: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
}

const isServer = typeof window === 'undefined'

export function ReactLocationDevtools({
  initialIsOpen,
  panelProps = {},
  closeButtonProps = {},
  toggleButtonProps = {},
  position = 'bottom-left',
  containerElement: Container = 'footer',
}: DevtoolsOptions): React.ReactElement | null {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useLocalStorage(
    'reactLocationDevtoolsOpen',
    initialIsOpen,
  )
  const [devtoolsHeight, setDevtoolsHeight] = useLocalStorage<number | null>(
    'reactLocationDevtoolsHeight',
    null,
  )
  const [isResolvedOpen, setIsResolvedOpen] = useSafeState(false)
  const [isResizing, setIsResizing] = useSafeState(false)
  const isMounted = useIsMounted()

  const handleDragStart = (
    panelElement: HTMLDivElement | null,
    startEvent: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    if (startEvent.button !== 0) return // Only allow left click for drag

    setIsResizing(true)

    const dragInfo = {
      originalHeight: panelElement?.getBoundingClientRect().height ?? 0,
      pageY: startEvent.pageY,
    }

    const run = (moveEvent: MouseEvent) => {
      const delta = dragInfo.pageY - moveEvent.pageY
      const newHeight = dragInfo?.originalHeight + delta

      setDevtoolsHeight(newHeight)

      if (newHeight < 70) {
        setIsOpen(false)
      } else {
        setIsOpen(true)
      }
    }

    const unsub = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', run)
      document.removeEventListener('mouseUp', unsub)
    }

    document.addEventListener('mousemove', run)
    document.addEventListener('mouseup', unsub)
  }

  React.useEffect(() => {
    setIsResolvedOpen(isOpen ?? false)
  }, [isOpen, isResolvedOpen, setIsResolvedOpen])

  // Toggle panel visibility before/after transition (depending on direction).
  // Prevents focusing in a closed panel.
  React.useEffect(() => {
    const ref = panelRef.current
    if (ref) {
      const handlePanelTransitionStart = () => {
        if (ref && isResolvedOpen) {
          ref.style.visibility = 'visible'
        }
      }

      const handlePanelTransitionEnd = () => {
        if (ref && !isResolvedOpen) {
          ref.style.visibility = 'hidden'
        }
      }

      ref.addEventListener('transitionstart', handlePanelTransitionStart)
      ref.addEventListener('transitionend', handlePanelTransitionEnd)

      return () => {
        ref.removeEventListener('transitionstart', handlePanelTransitionStart)
        ref.removeEventListener('transitionend', handlePanelTransitionEnd)
      }
    }
  }, [isResolvedOpen])

  React[isServer ? 'useEffect' : 'useLayoutEffect'](() => {
    if (isResolvedOpen) {
      const previousValue = rootRef.current?.parentElement?.style.paddingBottom

      const run = () => {
        const containerHeight = panelRef.current?.getBoundingClientRect().height
        if (rootRef.current?.parentElement) {
          rootRef.current.parentElement.style.paddingBottom = `${containerHeight}px`
        }
      }

      run()

      if (typeof window !== 'undefined') {
        window.addEventListener('resize', run)

        return () => {
          window.removeEventListener('resize', run)
          if (
            rootRef.current?.parentElement &&
            typeof previousValue === 'string'
          ) {
            rootRef.current.parentElement.style.paddingBottom = previousValue
          }
        }
      }
    }
  }, [isResolvedOpen])

  const { style: panelStyle = {}, ...otherPanelProps } = panelProps

  const {
    style: closeButtonStyle = {},
    onClick: onCloseClick,
    ...otherCloseButtonProps
  } = closeButtonProps

  const {
    style: toggleButtonStyle = {},
    onClick: onToggleClick,
    ...otherToggleButtonProps
  } = toggleButtonProps

  // Do not render on the server
  if (!isMounted()) return null

  return (
    <Container ref={rootRef} className="ReactLocationDevtools">
      <ThemeProvider theme={theme}>
        <ReactLocationDevtoolsPanel
          ref={panelRef as any}
          {...otherPanelProps}
          style={{
            position: 'fixed',
            bottom: '0',
            right: '0',
            zIndex: 99999,
            width: '100%',
            height: devtoolsHeight ?? 500,
            maxHeight: '90%',
            boxShadow: '0 0 20px rgba(0,0,0,.3)',
            borderTop: `1px solid ${theme.gray}`,
            transformOrigin: 'top',
            // visibility will be toggled after transitions, but set initial state here
            visibility: isOpen ? 'visible' : 'hidden',
            ...panelStyle,
            ...(isResizing
              ? {
                  transition: `none`,
                }
              : { transition: `all .2s ease` }),
            ...(isResolvedOpen
              ? {
                  opacity: 1,
                  pointerEvents: 'all',
                  transform: `translateY(0) scale(1)`,
                }
              : {
                  opacity: 0,
                  pointerEvents: 'none',
                  transform: `translateY(15px) scale(1.02)`,
                }),
          }}
          isOpen={isResolvedOpen}
          setIsOpen={setIsOpen}
          handleDragStart={(e) => handleDragStart(panelRef.current, e)}
        />
        {isResolvedOpen ? (
          <Button
            type="button"
            aria-label="Close React Location Devtools"
            {...(otherCloseButtonProps as unknown)}
            onClick={(e) => {
              setIsOpen(false)
              onCloseClick && onCloseClick(e)
            }}
            style={{
              position: 'fixed',
              zIndex: 99999,
              margin: '.5em',
              bottom: 0,
              ...(position === 'top-right'
                ? {
                    right: '0',
                  }
                : position === 'top-left'
                ? {
                    left: '0',
                  }
                : position === 'bottom-right'
                ? {
                    right: '0',
                  }
                : {
                    left: '0',
                  }),
              ...closeButtonStyle,
            }}
          >
            Close
          </Button>
        ) : null}
      </ThemeProvider>
      {!isResolvedOpen ? (
        <button
          type="button"
          {...otherToggleButtonProps}
          aria-label="Open React Location Devtools"
          onClick={(e) => {
            setIsOpen(true)
            onToggleClick && onToggleClick(e)
          }}
          style={{
            background: 'none',
            border: 0,
            padding: 0,
            position: 'fixed',
            zIndex: 99999,
            display: 'inline-flex',
            fontSize: '1.5em',
            margin: '.5em',
            cursor: 'pointer',
            width: 'fit-content',
            ...(position === 'top-right'
              ? {
                  top: '0',
                  right: '0',
                }
              : position === 'top-left'
              ? {
                  top: '0',
                  left: '0',
                }
              : position === 'bottom-right'
              ? {
                  bottom: '0',
                  right: '0',
                }
              : {
                  bottom: '0',
                  left: '0',
                }),
            ...toggleButtonStyle,
          }}
        >
          <Logo aria-hidden />
        </button>
      ) : null}
    </Container>
  )
}

export const ReactLocationDevtoolsPanel = React.forwardRef<
  HTMLDivElement,
  DevtoolsPanelOptions
>(function ReactLocationDevtoolsPanel(props, ref): React.ReactElement {
  const { isOpen = true, setIsOpen, handleDragStart, ...panelProps } = props

  const router = useRouter()

  const [activeMatchId, setActiveRouteId] = useLocalStorage(
    'reactLocationDevtoolsActiveRouteId',
    '',
  )

  const activeMatch = router.state.matches.find((d) => d.id === activeMatchId)

  return (
    <ThemeProvider theme={theme}>
      <Panel ref={ref} className="ReactLocationDevtoolsPanel" {...panelProps}>
        <style
          dangerouslySetInnerHTML={{
            __html: `
            .ReactLocationDevtoolsPanel * {
              scrollbar-color: ${theme.backgroundAlt} ${theme.gray};
            }

            .ReactLocationDevtoolsPanel *::-webkit-scrollbar, .ReactLocationDevtoolsPanel scrollbar {
              width: 1em;
              height: 1em;
            }

            .ReactLocationDevtoolsPanel *::-webkit-scrollbar-track, .ReactLocationDevtoolsPanel scrollbar-track {
              background: ${theme.backgroundAlt};
            }

            .ReactLocationDevtoolsPanel *::-webkit-scrollbar-thumb, .ReactLocationDevtoolsPanel scrollbar-thumb {
              background: ${theme.gray};
              border-radius: .5em;
              border: 3px solid ${theme.backgroundAlt};
            }
          `,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '4px',
            marginBottom: '-4px',
            cursor: 'row-resize',
            zIndex: 100000,
          }}
          onMouseDown={handleDragStart}
        ></div>
        <div
          style={{
            flex: '1 1 500px',
            minHeight: '40%',
            maxHeight: '100%',
            overflow: 'auto',
            borderRight: `1px solid ${theme.grayAlt}`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '.5em',
              background: theme.backgroundAlt,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Logo
              aria-hidden
              style={{
                marginRight: '.5em',
              }}
            />
            <div
              style={{
                marginRight: 'auto',
                fontSize: 'clamp(.8rem, 2vw, 1.3rem)',
                fontWeight: 'bold',
              }}
            >
              React Location{' '}
              <span
                style={{
                  fontWeight: 100,
                }}
              >
                Devtools
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* <QueryKeys style={{ marginBottom: '.5em' }}>
                <QueryKey
                  style={{
                    background: theme.success,
                    opacity: hasFresh ? 1 : 0.3,
                  }}
                >
                  fresh <Code>({hasFresh})</Code>
                </QueryKey>{' '}
                <QueryKey
                  style={{
                    background: theme.active,
                    opacity: hasFetching ? 1 : 0.3,
                  }}
                >
                  fetching <Code>({hasFetching})</Code>
                </QueryKey>{' '}
                <QueryKey
                  style={{
                    background: theme.warning,
                    color: 'black',
                    textShadow: '0',
                    opacity: hasStale ? 1 : 0.3,
                  }}
                >
                  stale <Code>({hasStale})</Code>
                </QueryKey>{' '}
                <QueryKey
                  style={{
                    background: theme.gray,
                    opacity: hasInactive ? 1 : 0.3,
                  }}
                >
                  inactive <Code>({hasInactive})</Code>
                </QueryKey>
              </QueryKeys> */}
              {/* <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Input
                  placeholder="Filter"
                  aria-label="Filter by matchhash"
                  value={filter ?? ''}
                  onChange={(e) => setFilter(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setFilter('')
                  }}
                  style={{
                    flex: '1',
                    marginRight: '.5em',
                  }}
                />
                {!filter ? (
                  <>
                    <Select
                      aria-label="Sort queries"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                      style={{
                        flex: '1',
                        minWidth: 75,
                        marginRight: '.5em',
                      }}
                    >
                      {Object.keys(sortFns).map((key) => (
                        <option key={key} value={key}>
                          Sort by {key}
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      onClick={() => setSortDesc((old) => !old)}
                      style={{
                        padding: '.3em .4em',
                      }}
                    >
                      {sortDesc ? '⬇ Desc' : '⬆ Asc'}
                    </Button>
                  </>
                ) : null}
              </div> */}
            </div>
          </div>
          <div
            style={{
              overflowY: 'auto',
              flex: '1',
            }}
          >
            <div
              style={{
                padding: '.5em',
              }}
            >
              <Explorer
                label="Location"
                value={router.state.location}
                defaultExpanded={{
                  search: true,
                }}
              />
            </div>
            <div
              style={{
                padding: '.5em',
              }}
            >
              <Explorer
                label="Router"
                value={{
                  basepath: router.basepath,
                  routes: router.routes,
                  routesById: router.routesById,
                  matchCache: router.matchCache,
                  defaultLinkPreloadMaxAge: router.defaultLinkPreloadMaxAge,
                  defaultLoaderMaxAge: router.defaultLoaderMaxAge,
                  defaultPendingMinMs: router.defaultPendingMinMs,
                  defaultPendingMs: router.defaultPendingMs,
                  defaultElement: router.defaultElement,
                  defaultErrorElement: router.defaultErrorElement,
                  defaultPendingElement: router.defaultPendingElement,
                }}
                defaultExpanded={{}}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            flex: '1 1 500px',
            minHeight: '40%',
            maxHeight: '100%',
            overflow: 'auto',
            borderRight: `1px solid ${theme.grayAlt}`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '.5em',
              background: theme.backgroundAlt,
              position: 'sticky',
              top: 0,
              zIndex: 1,
            }}
          >
            Current Matches
          </div>
          {router.state.matches.map((match, i) => {
            return (
              <div
                key={match.id || i}
                role="button"
                aria-label={`Open match details for ${match.id}`}
                onClick={() =>
                  setActiveRouteId(activeMatchId === match.id ? '' : match.id)
                }
                style={{
                  display: 'flex',
                  borderBottom: `solid 1px ${theme.grayAlt}`,
                  cursor: 'pointer',
                  alignItems: 'center',
                  background:
                    match === activeMatch ? 'rgba(255,255,255,.1)' : undefined,
                }}
              >
                <div
                  style={{
                    flex: '0 0 auto',
                    width: '1.3rem',
                    height: '1.3rem',
                    marginLeft: '.25rem',
                    background: getStatusColor(match, theme),
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    borderRadius: '.25rem',
                    transition: 'all .2s ease-out',
                  }}
                />
                {/* {isDisabled ? (
                    <div
                      style={{
                        flex: '0 0 auto',
                        height: '2em',
                        background: theme.gray,
                        display: 'flex',
                        alignItems: 'center',
                        fontWeight: 'bold',
                        padding: '0 0.5em',
                      }}
                    >
                      disabled
                    </div>
                  ) : null} */}
                <Code
                  style={{
                    padding: '.5em',
                  }}
                >
                  {`${match.id}`}
                </Code>
              </div>
            )
          })}
          <div
            style={{
              marginTop: '2rem',
              padding: '.5em',
              background: theme.backgroundAlt,
              position: 'sticky',
              top: 0,
              zIndex: 1,
            }}
          >
            Pending Matches
          </div>
          {router.pending?.matches.map((match, i) => {
            return (
              <div
                key={match.id || i}
                role="button"
                aria-label={`Open match details for ${match.id}`}
                onClick={() =>
                  setActiveRouteId(activeMatchId === match.id ? '' : match.id)
                }
                style={{
                  display: 'flex',
                  borderBottom: `solid 1px ${theme.grayAlt}`,
                  cursor: 'pointer',
                  background:
                    match === activeMatch ? 'rgba(255,255,255,.1)' : undefined,
                }}
              >
                <div
                  style={{
                    flex: '0 0 auto',
                    width: '1.3rem',
                    height: '1.3rem',
                    marginLeft: '.25rem',
                    background: getStatusColor(match, theme),
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    borderRadius: '.25rem',
                    transition: 'all .2s ease-out',
                  }}
                />
                {/* {isDisabled ? (
                    <div
                      style={{
                        flex: '0 0 auto',
                        height: '2em',
                        background: theme.gray,
                        display: 'flex',
                        alignItems: 'center',
                        fontWeight: 'bold',
                        padding: '0 0.5em',
                      }}
                    >
                      disabled
                    </div>
                  ) : null} */}
                <Code
                  style={{
                    padding: '.5em',
                  }}
                >
                  {`${match.id}`}
                </Code>
              </div>
            )
          })}
        </div>

        {activeMatch ? (
          <ActivePanel>
            <div
              style={{
                padding: '.5em',
                background: theme.backgroundAlt,
                position: 'sticky',
                top: 0,
                zIndex: 1,
              }}
            >
              Match Details
            </div>
            <div
              style={{
                padding: '.5em',
              }}
            >
              <div
                style={{
                  marginBottom: '.5em',
                  display: 'flex',
                  alignItems: 'stretch',
                  justifyContent: 'space-between',
                }}
              >
                <Code
                  style={{
                    lineHeight: '1.8em',
                  }}
                >
                  <pre
                    style={{
                      margin: 0,
                      padding: 0,
                      overflow: 'auto',
                    }}
                  >
                    {JSON.stringify(activeMatch.id, null, 2)}
                  </pre>
                </Code>
                {/* <span
                  style={{
                    padding: '0.3em .6em',
                    borderRadius: '0.4em',
                    fontWeight: 'bold',
                    textShadow: '0 2px 10px black',
                    background: getQueryStatusColor(activeMatch, theme),
                    flexShrink: 0,
                  }}
                >
                  {getQueryStatusLabel(activeMatch)}
                </span> */}
              </div>
              {/* <div
                style={{
                  marginBottom: '.5em',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                Observers: <Code>{activeMatch.getObserversCount()}</Code>
              </div> */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                Last Updated:{' '}
                {activeMatch.updatedAt ? (
                  <Code>
                    {new Date(activeMatch.updatedAt).toLocaleTimeString()}
                  </Code>
                ) : (
                  'N/A'
                )}
              </div>
            </div>
            {/*<div
              style={{
                background: theme.backgroundAlt,
                padding: '.5em',
                position: 'sticky',
                top: 0,
                zIndex: 1,
              }}
            >
              Actions
            </div>
             <div
              style={{
                padding: '0.5em',
              }}
            >
              <Button
                type="button"
                onClick={() => matchClient.invalidateQueries(activeMatch)}
                style={{
                  background: theme.warning,
                  color: theme.inputTextColor,
                }}
              >
                Invalidate
              </Button>{' '}
              <Button
                type="button"
                onClick={() => matchClient.resetQueries(activeMatch)}
                style={{
                  background: theme.gray,
                }}
              >
                Reset
              </Button>{' '}
              <Button
                type="button"
                onClick={() => matchClient.removeQueries(activeMatch)}
                style={{
                  background: theme.danger,
                }}
              >
                Remove
              </Button>
            </div> */}
            <div
              style={{
                background: theme.backgroundAlt,
                padding: '.5em',
                position: 'sticky',
                top: 0,
                zIndex: 1,
              }}
            >
              Explorer
            </div>
            <div
              style={{
                padding: '.5em',
              }}
            >
              <Explorer
                label="Match"
                value={activeMatch}
                defaultExpanded={{}}
              />
            </div>
          </ActivePanel>
        ) : null}
      </Panel>
    </ThemeProvider>
  )
})
