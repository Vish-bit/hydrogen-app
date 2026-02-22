import { redirect, useLoaderData } from 'react-router';
import { getPaginationVariables, Analytics } from '@shopify/hydrogen';
import { PaginatedResourceSection } from '~/components/PaginatedResourceSection';
import { redirectIfHandleIsLocalized } from '~/lib/redirect';
import { ProductItem } from '~/components/ProductItem';
import collectionsData from '../data/collections-data.json';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({ data }) => {
  return [{ title: `Hydrogen | ${data?.collection.title ?? ''} Collection` }];
};

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader(args) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return { ...deferredData, ...criticalData };
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 * @param {Route.LoaderArgs}
 */
async function loadCriticalData({ context, params, request }) {
  const { handle } = params;
  const { storefront } = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 8,
  });

  if (!handle) {
    throw redirect('/collections');
  }

  const [{ collection }] = await Promise.all([
    storefront.query(COLLECTION_QUERY, {
      variables: { handle, ...paginationVariables },
      // Add other queries here, so that they are loaded in parallel
    }),
  ]);

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {
      status: 404,
    });
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, { handle, data: collection });

  return {
    collection,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 * @param {Route.LoaderArgs}
 */
function loadDeferredData({ context }) {
  return {};
}

// Slider functions
let currentSlide = 0;
let showLeftArrow = false;
let showRightArrow = true;
let scrollInterval = null;

function getImagesPerRow() {
  const width = window.innerWidth;
  if (width >= 1024) return 5; // lg
  if (width >= 768) return 3;  // md
  return 1; // mobile
}

function startScrolling(direction) {
  // Clear any existing interval
  if (scrollInterval) {
    clearInterval(scrollInterval);
  }
  
  // Start continuous scrolling
  scrollInterval = setInterval(() => {
    scrollSlider(direction);
  }, 400); // Scroll every 400ms
}

function stopScrolling() {
  if (scrollInterval) {
    clearInterval(scrollInterval);
    scrollInterval = null;
  }
}

function handleArrowClick(direction) {
  // Single click - move one position
  scrollSlider(direction);
  // Also start continuous scrolling in case user holds
  startScrolling(direction);
}

function scrollSlider(direction) {
  const slider = document.getElementById('imageSlider');
  if (!slider) return;
  
  const imagesPerRow = getImagesPerRow();
  const originalImagesCount = slider.children.length / 2; // Half are duplicates
  
  if (direction === 'left') {
    currentSlide = currentSlide - imagesPerRow;
    if (currentSlide < 0) {
      currentSlide = originalImagesCount - imagesPerRow;
    }
  } else {
    currentSlide = currentSlide + imagesPerRow;
    if (currentSlide >= originalImagesCount) {
      currentSlide = 0;
    }
  }
  
  updateSlider();
  updateArrowVisibility();
}

function goToSlide(index) {
  const imagesPerRow = getImagesPerRow();
  currentSlide = index * imagesPerRow;
  updateSlider();
  updateArrowVisibility();
}

function updateSlider() {
  const slider = document.getElementById('imageSlider');
  if (!slider) return;
  
  const imagesPerRow = getImagesPerRow();
  const slidePercentage = (currentSlide / imagesPerRow) * (100 / imagesPerRow);
  slider.style.transform = `translateX(-${slidePercentage}%)`;
}

function updateArrowVisibility() {
  const imagesPerRow = getImagesPerRow();
  const originalImagesCount = 34; // Based on your JSON data
  
  // Hide left arrow if at start
  showLeftArrow = currentSlide > 0;
  
  // Hide right arrow if at end
  showRightArrow = currentSlide < originalImagesCount - imagesPerRow;
  
  // Update button visibility
  const leftButton = document.querySelector('[aria-label="Previous images"]');
  const rightButton = document.querySelector('[aria-label="Next images"]');
  
  if (leftButton) {
    leftButton.style.display = showLeftArrow ? 'flex' : 'none';
  }
  if (rightButton) {
    rightButton.style.display = showRightArrow ? 'flex' : 'none';
  }
}

// Add resize listener to handle screen size changes
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    currentSlide = 0; // Reset to first position on resize
    updateSlider();
    updateArrowVisibility();
  });
  
  // Stop scrolling when user releases mouse button anywhere
  document.addEventListener('mouseup', stopScrolling);
  document.addEventListener('mouseleave', stopScrolling);
}

export default function Collection() {
  /** @type {LoaderReturnData} */
  const { collection } = useLoaderData();

  // Get custom data from JSON with new structure, fallback to Shopify data
  const customData = collectionsData.data || {};
  const title = customData.title || collection.title;
  const description = customData.description || collection.description;
  const images = customData.images || [];

  return (
    <div className="collection">
      <div className="mb-8">
        <div className="max-w-xl mx-auto">
          <h1 style={{ textAlign: 'center' }}>{title}</h1>
          <p className="collection-description text-center">{description}</p>
        </div>

        {/* Image Slider */}
        {images.length > 0 && (
          <div className="relative w-full overflow-hidden">
            <div 
              className="flex transition-transform duration-1200 ease-[cubic-bezier(0.25,0.1,0.75,1)] gap-15"
              id="imageSlider"
            >
              {/* Original images */}
              {images.map((image, index) => (
                <div key={`original-${index}`} className="w-auto flex-shrink-0">
                  <img
                    src={image}
                    alt={`${title} - Image ${index + 1}`}
                    className="w-auto h-35 md:h-35 lg:h-35 object-cover !rounded-lg border border-gray-200 hover:border-gray-600 transition-colors cursor-pointer"
                  />
                </div>
              ))}
              {/* Duplicated images for infinite loop */}
              {images.map((image, index) => (
                <div key={`duplicate-${index}`} className="w-auto md:w-1/3 lg:w-1/5 flex-shrink-0">
                  <img
                    src={image}
                    alt={`${title} - Image ${index + 1}`}
                    className="w-auto h-35 md:h-35 lg:h-35 object-cover"
                  />
                </div>
              ))}
            </div>

            {/* Left Arrow */}
            <button
              onClick={() => handleArrowClick('left')}
              onMouseDown={() => startScrolling('left')}
              onMouseUp={stopScrolling}
              onMouseLeave={stopScrolling}
              className="absolute left-2 md:left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-1 md:p-2 shadow-lg transition-all duration-200 z-10 shadow-2xl cursor-pointer"
              aria-label="Previous images"
            >
              <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            {/* Right Arrow */}
            <button
              onClick={() => handleArrowClick('right')}
              onMouseDown={() => startScrolling('right')}
              onMouseUp={stopScrolling}
              onMouseLeave={stopScrolling}
              className="absolute right-2 md:right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-1 md:p-2 shadow-lg transition-all duration-200 z-10 shadow-2xl cursor-pointer"
              aria-label="Next images"
            >
              <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItem on Product {
    id
    handle
    title
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
  }
`;

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor
      ) {
        nodes {
          ...ProductItem
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
`;

/** @typedef {import('./+types/collections.$handle').Route} Route */
/** @typedef {import('storefrontapi.generated').ProductItemFragment} ProductItemFragment */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
