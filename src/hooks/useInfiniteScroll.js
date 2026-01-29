import { useState, useEffect, useCallback, useRef } from 'react'

function useInfiniteScroll(items, itemsPerPage = 20) {
  const [displayedItems, setDisplayedItems] = useState([])
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const observerRef = useRef(null)

  // Reset when items change
  useEffect(() => {
    setDisplayedItems(items.slice(0, itemsPerPage))
    setPage(1)
    setHasMore(items.length > itemsPerPage)
  }, [items, itemsPerPage])

  // Load more items
  const loadMore = useCallback(() => {
    const nextPage = page + 1
    const startIndex = page * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const newItems = items.slice(startIndex, endIndex)

    if (newItems.length > 0) {
      setDisplayedItems(prev => [...prev, ...newItems])
      setPage(nextPage)
      setHasMore(endIndex < items.length)
    } else {
      setHasMore(false)
    }
  }, [items, page, itemsPerPage])

  // Intersection Observer callback
  const lastItemRef = useCallback(
    (node) => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore()
        }
      })

      if (node) {
        observerRef.current.observe(node)
      }
    },
    [hasMore, loadMore]
  )

  return { displayedItems, hasMore, lastItemRef }
}

export default useInfiniteScroll
