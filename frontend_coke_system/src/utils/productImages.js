// utils/productImages.js
const getMediaOrigin = () => {
  const envApiBase = process.env.REACT_APP_API_BASE;
  if (envApiBase) {
    if (typeof window === "undefined") {
      return "";
    }
    try {
      return new URL(envApiBase, window.location.origin).origin;
    } catch (error) {
      return "";
    }
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname, port, origin } = window.location;

    if (port === "3000" || port === "3001") {
      return `${protocol}//${hostname}:8080`;
    }

    return origin;
  }

  return "";
};

export const getProductImage = (product) => {
  // If there's an actual uploaded image, use it
  if (product.image_url) {
    if (/^https?:\/\//i.test(product.image_url)) {
      return product.image_url;
    }
    return `${getMediaOrigin()}${product.image_url}`;
  }

  const categoryName = product.product_category?.name?.toLowerCase() || 'general';
  const productName = product.product_name?.toLowerCase() || 'product';
  
  // Get price to determine size
  const price = product.price?.selling_price || product.price?.purchase_price || 0;
  
  // Price ranges for Filipino products (in pesos)
  const isSmall = price <= 15;        // 8-15 pesos = small bottle (200ml)
  const isMedium = price > 15 && price <= 50;  // 16-50 pesos = 1L bottle
  const isLarge = price > 50;         // 50+ pesos = 1.5L/2L bottle

  // === COCA-COLA PRODUCTS (Real specific images) ===
  if (productName.includes('coke') || productName.includes('coca cola')) {
    // Coke Swakto (specific product)
    if (productName.includes('swakto')) {
      return 'https://pfst.cf2.poecdn.net/base/image/942df9f4040d5cead7e441835cfc4c143d32536bd5342efa66268c767d8012cb?w=330&h=330'; // Coke Swakto
    }
    
    // Regular Coke based on price
    if (isSmall) {
      return 'https://pfst.cf2.poecdn.net/base/image/2a95f47fbc15bf22a67a9cc29b94a4dc027691c41e9058f599fed5a341713bda?w=867&h=1300'; // Small Coke 200ml (8-15 pesos)
    }
    if (isMedium) {
      return 'https://pfst.cf2.poecdn.net/base/image/20002a06933d43b884d66caf60e7799d6b885241bb62827523041bd6bf4b880a?w=233&h=216'; // Coke 1L (16-50 pesos)
    }
    if (isLarge) {
      return 'https://pfst.cf2.poecdn.net/base/image/da0bbd3429f5305deebd7fc5888ed8b7e6b8a4539a88ab16db6887bca2d60c18?w=2000&h=2000'; // Coke 1.5L/2L (50+ pesos)
    }
  }
  
  // === PEPSI PRODUCTS (Real Authentic Images) ===
  if (productName.includes('pepsi')) {
    if (price <= 15) {
      return 'https://pfst.cf2.poecdn.net/base/image/7b2ae0819efb0ca1ba14dfd5041e5d51b744c158eb696a53c015f75e47ef01cb?w=1700&h=1700'; // Pepsi 320ml can (8-15 pesos)
    }
    if (price <= 25) {
      return 'https://pfst.cf2.poecdn.net/base/image/0a38a45c66701695d4e9480f90b15740befba92b79eeb84fdf0cdadbd0c02923?w=2048&h=2048'; // Pepsi glass bottle (16-25 pesos)
    }
    if (price <= 50) {
      return 'https://pfst.cf2.poecdn.net/base/image/d35a102c3a6381217fa753999ea17faba83345dc386a2f41aef99d0fbd44d9e0?w=1500&h=1500'; // Pepsi plastic bottle (26-50 pesos)
    }
    return 'https://pfst.cf2.poecdn.net/base/image/975421f519ee9d11572ab3d539dda64294582a1bf2e3d441ebf1e5e2c4237733?w=900&h=600'; // Pepsi 1.5L bottle (50+ pesos)
  }
  
  // === SPRITE PRODUCTS (Real Authentic Images) ===
  if (productName.includes('sprite')) {
    if (price <= 15) {
      return 'https://pfst.cf2.poecdn.net/base/image/4463ada50a7e5843e9ada2aef1b5f79f15db365e2ce0a03fda1dc1ee57a03a01?w=1000&h=1000'; // Sprite 330ml can (8-15 pesos)
    }
    if (price <= 20) {
      return 'https://pfst.cf2.poecdn.net/base/image/aa0b0ed09dfbd394a00666ae00035483399949d7ea8e2c7818d6ed831ca3ba0b?w=1000&h=1000'; // Sprite 190ml small bottle (16-20 pesos)
    }
    if (price <= 30) {
      return 'https://pfst.cf2.poecdn.net/base/image/8b2208ca7a0d7373ea593b6f0a71d02569f555ed6ea2c7a05ddd77919f7d94ff?w=1500&h=1500'; // Sprite 355ml glass bottle (21-30 pesos)
    }
    return 'https://pfst.cf2.poecdn.net/base/image/1339bea906fae8282daa1e5aa98a0fb0c44442e1b6af83515542f1877a17b728?w=934&h=1200'; // Sprite 2L bottle (30+ pesos)
  }
  
  // === ROYAL PRODUCTS (Real Authentic Images) ===
  if (productName.includes('royal')) {
    // Royal Tru-Lemon variants
    if (productName.includes('lemon')) {
      if (price <= 15) {
        return 'https://pfst.cf2.poecdn.net/base/image/d290f6fa56c51ffc3e07448d330947482e360c844eb3e28b2d5ca502127076ad?w=1200&h=1200'; // Royal Tru-Lemon can (320ml) - small
      }
      if (price <= 25) {
        return 'https://pfst.cf2.poecdn.net/base/image/643c38da0c116ef0e3d367d30912d5af98f04c27a1f6e56516178e00bdcf1fc5?w=1100&h=1100'; // Royal Tru-Lemon bottle (237ml) - medium
      }
      return 'https://pfst.cf2.poecdn.net/base/image/643c38da0c116ef0e3d367d30912d5af98f04c27a1f6e56516178e00bdcf1fc5?w=1100&h=1100'; // Royal Tru-Lemon bottle - large
    }
    
    // Royal Tru-Orange variants (default Royal)
    if (price <= 15) {
      return 'https://pfst.cf2.poecdn.net/base/image/d4efec78bb4d55c094307985cda117567e16a15eb24d6c66cc825be0fe1a5850?w=800&h=800'; // Royal Tru-Orange can (330ml) - small
    }
    if (price <= 25) {
      return 'https://pfst.cf2.poecdn.net/base/image/1b2021a940c126a0379496cb49cf32f34d77f21d8818ec44db8a764ea9bd839e?w=1100&h=1100'; // Royal Tru-Orange bottle (237ml) - medium
    }
    if (price <= 50) {
      return 'https://pfst.cf2.poecdn.net/base/image/82902689e7eed4bc25ebae77a8aa77a88f826344c3c668c53f5178662e7d43f2?w=1000&h=1000'; // Royal small plastic bottle (190ml) - medium
    }
    return 'https://pfst.cf2.poecdn.net/base/image/37d80bf99de0246a8637fe50aa49b9ba2510f9784d2513fc0f68f8d2fbc7e104?w=720&h=720'; // Royal plastic bottle (1.5L) - large
  }
  
  // === BEER PRODUCTS (Real Filipino Beer Images) ===
  if (productName.includes('red horse')) {
    // Red Horse - specific sizes with authentic packaging
    if (price <= 25) {
      return 'https://pfst.cf2.poecdn.net/base/image/fc96d93fa235641e3a9cbbb4713211f5675d82d578fc7fec98a3554e4b3dbb23?w=1920&h=1920'; // Red Horse can (8-25 pesos)
    }
    if (price <= 70) {
      return 'https://pfst.cf2.poecdn.net/base/image/fe52132d6cc5c6d44555394c7fd946dc72a2bf22311458ffcb83e79e7a8ca01e?w=500&h=500'; // Red Horse regular bottle (26-70 pesos)
    }
    return 'https://pfst.cf2.poecdn.net/base/image/7dc846129a0a081c7d0a6d7e61d6754dbb28ce98ce81577b5a7bc97316c86c7f?w=1200&h=1200'; // Red Horse Litro bottle (70+ pesos)
  }
  
  if (productName.includes('san miguel') && (productName.includes('beer') || productName.includes('pale pilsen'))) {
    return 'https://pfst.cf2.poecdn.net/base/image/e509a17097797ea54fd57107d8a51c626fd1e0051c051865d379f04c63357784?w=500&h=500'; // Real San Miguel Pale Pilsen
  }
  
  if (productName.includes('gold eagle')) {
    if (price <= 25) {
      return 'https://pfst.cf2.poecdn.net/base/image/4c6e121a136d5b343bc3c446747b89f3b9f03d6b94e124bd4449cd9397b76428?w=500&h=1007'; // Gold Eagle small bottle
    }
    return 'https://pfst.cf2.poecdn.net/base/image/4c6e121a136d5b343bc3c446747b89f3b9f03d6b94e124bd4449cd9397b76428?w=500&h=1007'; // Gold Eagle family pack
  }
  
  if (productName.includes('mahou')) {
    return 'https://pfst.cf2.poecdn.net/base/image/d6e80f02bb59ec80755a395217429e51fe6f8150bd7fd0234c5b157df9757619?w=480&h=624'; // Real Mahou beer
  }
  
  if (productName.includes('heineken')) {
    return 'https://pfst.cf2.poecdn.net/base/image/64fea469d5e89a21c3b1748b753a619a4c967b545fe67c1ffa7e50d77a20ffa6?w=400&h=400'; // Real Heineken bottle
  }
  
  // Generic beer fallback - use San Miguel as default Filipino beer
  if (productName.includes('beer')) {
    return 'https://pfst.cf2.poecdn.net/base/image/e509a17097797ea54fd57107d8a51c626fd1e0051c051865d379f04c63357784?w=500&h=500'; // San Miguel Pale Pilsen as default beer
  }
  
  // === TANDUAY PRODUCTS (Real Authentic Images) ===
  if (productName.includes('tanduay')) {
    // Tanduay Ice variants (usually cheaper)
    if (productName.includes('ice')) {
      if (productName.includes('blue') || productName.includes('fresh')) {
        return 'https://pfst.cf2.poecdn.net/base/image/792d427cb213536c0338ddcbfe7e00099a5738ae242760a8c4a21051fa3e9ae9?w=1200&h=1200'; // Tanduay Ice Blue Fresh
      }
      if (productName.includes('vodka') || productName.includes('cranberry')) {
        return 'https://pfst.cf2.poecdn.net/base/image/25da4fed92481a8e6d7d1bd204754fa65c66536f57b908fa0b6098148f04887d?w=1500&h=1500'; // Tanduay Ice Vodka Cranberry
      }
      // Default Tanduay Ice
      return 'https://pfst.cf2.poecdn.net/base/image/6cbe7f6d708011f3ca04f9c72f4b4ebd55a4a38be725b8bac16037eb0370dc1f?w=1500&h=1500'; // Tanduay Ice Original
    }
    
    // Tanduay Double Rum (premium)
    if (productName.includes('double') || price >= 300) {
      return 'https://pfst.cf2.poecdn.net/base/image/5e6a4468461b1807067a8892e0753bde0cfc7e20c7e9b0417feab566f96caa18?w=1080&h=1201'; // Tanduay Double Rum (750ml)
    }
    
    // Regular Tanduay Rum based on price
    if (price <= 100) {
      return 'https://pfst.cf2.poecdn.net/base/image/721ac5be7109fa8ff5d89a19211b9ad26de90e12025f7218ce07ef2126182ca5?w=600&h=600'; // Tanduay small bottle
    }
    
    // Default Tanduay Dark Rum
    return 'https://pfst.cf2.poecdn.net/base/image/a0f505882ad198000fcc113ba0c2ae6179722eebeb805a890bef2f85960af9e0?w=1100&h=1100'; // Tanduay Rhum Dark (375ml)
  }
  
  // === OTHER ALCOHOL PRODUCTS ===
  if (productName.includes('rum')) {
    return 'https://pfst.cf2.poecdn.net/base/image/a0f505882ad198000fcc113ba0c2ae6179722eebeb805a890bef2f85960af9e0?w=1100&h=1100'; // Use Tanduay as default rum
  }
  
  if (productName.includes('whiskey') || productName.includes('gin') || productName.includes('vodka')) {
    return 'https://pfst.cf2.poecdn.net/base/image/1a69b06821dd0cafbf0b43ddd017568bc12eee0b81e3c26ef25a9b26deb8921d?w=400&h=400'; // Original whiskey bottle
  }
  
  // === WATER PRODUCTS (Real Authentic Images) ===
  if (productName.includes('water') || productName.includes('mineral')) {
    if (productName.includes('nature') || productName.includes('natures spring')) {
      return 'https://pfst.cf2.poecdn.net/base/image/1ec47bd62606dc79bde2010ae150a79f057745a87a4ea6c8c6d842308e6c77b8?w=1012&h=1120'; // Nature's Spring Water 1000ml
    }
    if (productName.includes('premier')) {
      return 'https://pfst.cf2.poecdn.net/base/image/ef30a9ee8f9e0335aa8dac8f384e2380d8f70ca1cc6b6506f4be589488184744?w=680&h=1024'; // Premier Water 500ml
    }
    if (productName.includes('crystal')) {
      return 'https://pfst.cf2.poecdn.net/base/image/f057d20c9938d71a44777c01bd3efcf2a415f7a58b4cf0555d86f1f5e0f4dbb7?w=520&h=520'; // Crystal Geyser Water
    }
    // Default water - use Nature's Spring
    return 'https://pfst.cf2.poecdn.net/base/image/1ec47bd62606dc79bde2010ae150a79f057745a87a4ea6c8c6d842308e6c77b8?w=1012&h=1120'; // Nature's Spring as default water
  }
  
  // === JUICE PRODUCTS (Real images) ===
  if (productName.includes('juice') || productName.includes('orange') || productName.includes('apple') || productName.includes('mango')) {
    return 'https://pfst.cf2.poecdn.net/base/image/88635f54086aafb9d7b262bcf8a1d0e857281bf4d55d2bd90248ea228f535e7b?w=400&h=400'; // Real orange juice bottle
  }
  
  // === ENERGY DRINKS (Real Authentic Filipino Images) ===
  if (productName.includes('red bull') || productName.includes('redbull')) {
    return 'https://pfst.cf2.poecdn.net/base/image/7729e53b73c21e0c29505a8d9ad45b1c075bbe7da97ce41786f4b479d4d394fc?w=400&h=400'; // Real energy drink can
  }
  
  if (productName.includes('monster')) {
    return 'https://pfst.cf2.poecdn.net/base/image/7729e53b73c21e0c29505a8d9ad45b1c075bbe7da97ce41786f4b479d4d394fc?w=400&h=400'; // Real Monster energy can
  }
  
  if (productName.includes('cobra')) {
    return 'https://pfst.cf2.poecdn.net/base/image/21abc1c91657e2f7898f5a5548776cbb04550d07c457b9a8c54e9445105af0ca?w=600&h=600'; // Real Cobra Energy Drink
  }
  
  if (productName.includes('predator')) {
    return 'https://pfst.cf2.poecdn.net/base/image/e6334d726cffd2f4f6fb97f9caa8b673f948fe2f6ae56383c7cec12dd6f4dde7?w=1000&h=1000'; // Real Predator Energy Drink
  }
  
  if (productName.includes('sting')) {
    return 'https://pfst.cf2.poecdn.net/base/image/ab33d34640f971a408884276f24d4f9cc9edf9359dacdfe87b77fba090dfcc68?w=980&h=980'; // Real Sting Energy Drink
  }
  
  if (productName.includes('energy')) {
    return 'https://pfst.cf2.poecdn.net/base/image/21abc1c91657e2f7898f5a5548776cbb04550d07c457b9a8c54e9445105af0ca?w=600&h=600'; // Default to Cobra energy drink
  }
  
  // === COFFEE PRODUCTS (Real images) ===
  if (productName.includes('coffee') || productName.includes('nescafe') || productName.includes('kopiko')) {
    return 'https://pfst.cf2.poecdn.net/base/image/2da184a85ef4d4038fb1b0c555a89ad10efc571156763d663ca028f35d8f0f4c?w=400&h=400'; // Real coffee cups
  }
  
  // === MILK PRODUCTS (Real Authentic Images) ===
  if (productName.includes('milk') || productName.includes('bear brand')) {
    // Dutch Mill products
    if (productName.includes('dutch mill') || productName.includes('dutchmill')) {
      if (productName.includes('strawberry')) {
        return 'https://pfst.cf2.poecdn.net/base/image/38015ec975eb9034631e3d72c405f94578c6dad98c919e2c7b872b511dd7c96c?w=600&h=600'; // Dutch Mill Strawberry Yogurt Drink 90ml
      }
      if (productName.includes('mixed fruits') || productName.includes('fruits')) {
        return 'https://pfst.cf2.poecdn.net/base/image/ab44b7a0c8b0d4fb0b1e26f987a625ffaeb0ea2dcf143a433fefcf5e40790cb2?w=2100&h=2100'; // Dutch Mill Mixed Fruits Yogurt Drink 90ml
      }
      // Default Dutch Mill
      return 'https://pfst.cf2.poecdn.net/base/image/ab44b7a0c8b0d4fb0b1e26f987a625ffaeb0ea2dcf143a433fefcf5e40790cb2?w=2100&h=2100'; // Dutch Mill Mixed Fruits as default
    }
    
    // Default milk - use Dutch Mill as placeholder
    return 'https://pfst.cf2.poecdn.net/base/image/38015ec975eb9034631e3d72c405f94578c6dad98c919e2c7b872b511dd7c96c?w=600&h=600'; // Dutch Mill Strawberry as default milk
  }

  // === TEA PRODUCTS (Real Authentic C2 Images) ===
  if (productName.includes('c2') || productName.includes('green tea') || productName.includes('tea')) {
    if (productName.includes('apple')) {
      if (price <= 20) {
        return 'https://pfst.cf2.poecdn.net/base/image/c9de2dba4d6f111f3f5761c6642e2ef430ab3dc5b1240ecad76b171c809e7991?w=1250&h=1250'; // C2 Solo Apple Green Tea 230ml (15-20 pesos)
      }
      if (price <= 30) {
        return 'https://pfst.cf2.poecdn.net/base/image/0d0ae276fbb9d7a3c70a710ce0dc1b8943bd78f7bf52903fe7a84b8da2396abd?w=2000&h=2000'; // C2 Apple Green Tea 500ml (21-30 pesos)
      }
      return 'https://pfst.cf2.poecdn.net/base/image/fb5d2300719582fa8f26a8677f228a72a8ac39d939d92606d25d868983540865?w=640&h=640'; // C2 Apple Green Tea 1L (30+ pesos)
    }
    
    // Default C2 Green Tea
    return 'https://pfst.cf2.poecdn.net/base/image/0d0ae276fbb9d7a3c70a710ce0dc1b8943bd78f7bf52903fe7a84b8da2396abd?w=2000&h=2000'; // C2 Apple Green Tea 500ml as default
  }

  // Category-based fallback images with price consideration
  const categoryImages = {
    'beverages': isSmall ? 'https://pfst.cf2.poecdn.net/base/image/2a95f47fbc15bf22a67a9cc29b94a4dc027691c41e9058f599fed5a341713bda?w=867&h=1300' : 'https://pfst.cf2.poecdn.net/base/image/20002a06933d43b884d66caf60e7799d6b885241bb62827523041bd6bf4b880a?w=233&h=216',
    'drinks': isSmall ? 'https://pfst.cf2.poecdn.net/base/image/4463ada50a7e5843e9ada2aef1b5f79f15db365e2ce0a03fda1dc1ee57a03a01?w=1000&h=1000' : 'https://pfst.cf2.poecdn.net/base/image/1339bea906fae8282daa1e5aa98a0fb0c44442e1b6af83515542f1877a17b728?w=934&h=1200', // Use Sprite as default drink
    'softdrinks': isSmall ? 'https://pfst.cf2.poecdn.net/base/image/4463ada50a7e5843e9ada2aef1b5f79f15db365e2ce0a03fda1dc1ee57a03a01?w=1000&h=1000' : 'https://pfst.cf2.poecdn.net/base/image/1339bea906fae8282daa1e5aa98a0fb0c44442e1b6af83515542f1877a17b728?w=934&h=1200', // Use Sprite as default softdrink
    'alcohol': 'https://pfst.cf2.poecdn.net/base/image/a0f505882ad198000fcc113ba0c2ae6179722eebeb805a890bef2f85960af9e0?w=1100&h=1100', // Tanduay as default alcohol
    'beer': 'https://pfst.cf2.poecdn.net/base/image/e509a17097797ea54fd57107d8a51c626fd1e0051c051865d379f04c63357784?w=500&h=500', // San Miguel as default beer
    'food': 'https://pfst.cf2.poecdn.net/base/image/88635f54086aafb9d7b262bcf8a1d0e857281bf4d55d2bd90248ea228f535e7b?w=400&h=400',
    'snacks': 'https://pfst.cf2.poecdn.net/base/image/88635f54086aafb9d7b262bcf8a1d0e857281bf4d55d2bd90248ea228f535e7b?w=400&h=400',
    'content': isSmall ? 'https://pfst.cf2.poecdn.net/base/image/2a95f47fbc15bf22a67a9cc29b94a4dc027691c41e9058f599fed5a341713bda?w=867&h=1300' : 'https://pfst.cf2.poecdn.net/base/image/20002a06933d43b884d66caf60e7799d6b885241bb62827523041bd6bf4b880a?w=233&h=216',
    'one way': 'https://pfst.cf2.poecdn.net/base/image/2a95f47fbc15bf22a67a9cc29b94a4dc027691c41e9058f599fed5a341713bda?w=867&h=1300', // Usually small/disposable
    'default': 'https://pfst.cf2.poecdn.net/base/image/942df9f4040d5cead7e441835cfc4c143d32536bd5342efa66268c767d8012cb?w=330&h=330'
  };

  return categoryImages[categoryName] || categoryImages['default'];
};
