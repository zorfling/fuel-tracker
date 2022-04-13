import turfDistance from '@turf/distance';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import { enAU } from 'date-fns/locale';
import Geo from 'geo-nearby';
import type { NextApiRequest, NextApiResponse } from 'next';

export interface FuelEntry {
  id: number;
  name: string;
  address: string;
  postcode: string;
  distance: number;
  distanceString: string;
  price: number;
  brandId: number;
  brandLogo: string;
  lastUpdated: string;
  lat: number;
  lng: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FuelEntry[]>
) {
  const { lat, lng } = req.query;

  const countryId = 21;
  let geoRegionId = 1;
  let geoRegionLevel = 3;

  let logArray: string[] = [];

  const myLog = (log: string) => {
    logArray.push(log);
  };

  console.log = myLog;

  const base = process.env.FUEL_API_BASE;
  const token = process.env.FUEL_API_TOKEN;
  // const regionEndpoint = `Subscriber/GetCountryGeographicRegions?countryId=${countryId}`;
  const priceEndpoint = `Price/GetSitesPrices?countryId=${countryId}&geoRegionLevel=${geoRegionLevel}&geoRegionId=${geoRegionId}`;
  const instance = axios.create({
    baseURL: base,
    headers: {
      Authorization: `FPDAPI SubscriberToken=${token}`
    }
  });

  const brands = [
    {
      BrandId: 2,
      Name: 'Caltex'
    },
    {
      BrandId: 5,
      Name: 'BP'
    },
    {
      BrandId: 7,
      Name: 'Budget'
    },
    {
      BrandId: 12,
      Name: 'Independent'
    },
    {
      BrandId: 16,
      Name: 'Mobil'
    },
    {
      BrandId: 20,
      Name: 'Shell'
    },
    {
      BrandId: 23,
      Name: 'United'
    },
    {
      BrandId: 27,
      Name: 'Unbranded'
    },
    {
      BrandId: 39,
      Name: 'Matilda'
    },
    {
      BrandId: 51,
      Name: 'Apco'
    },
    {
      BrandId: 57,
      Name: 'Metro Fuel'
    },
    {
      BrandId: 65,
      Name: 'Petrogas'
    },
    {
      BrandId: 72,
      Name: 'Gull'
    },
    {
      BrandId: 86,
      Name: 'Liberty'
    },
    {
      BrandId: 87,
      Name: 'AM/PM'
    },
    {
      BrandId: 105,
      Name: 'Better Choice'
    },
    {
      BrandId: 108,
      Name: 'Unigas'
    },
    {
      BrandId: 110,
      Name: 'Freedom Fuels'
    },
    {
      BrandId: 111,
      Name: 'Coles Express'
    },
    {
      BrandId: 112,
      Name: 'Caltex Woolworths'
    },
    {
      BrandId: 113,
      Name: '7 Eleven'
    },
    {
      BrandId: 114,
      Name: 'Astron'
    },
    {
      BrandId: 115,
      Name: 'Prime Petroleum'
    },
    {
      BrandId: 116,
      Name: 'CQP'
    },
    {
      BrandId: 167,
      Name: 'Speedway'
    },
    {
      BrandId: 169,
      Name: 'On the Run'
    },
    {
      BrandId: 2301,
      Name: 'Choice'
    },
    {
      BrandId: 4896,
      Name: 'Mogas'
    },
    {
      BrandId: 5094,
      Name: 'Puma Energy'
    },
    {
      BrandId: 2031003,
      Name: 'IGA'
    },
    {
      BrandId: 2031031,
      Name: 'Costco'
    },
    {
      BrandId: 2418945,
      Name: 'Endeavour BP'
    },
    {
      BrandId: 2418946,
      Name: 'Riordan Fuel'
    },
    {
      BrandId: 2418947,
      Name: 'Riordan Fuels'
    },
    {
      BrandId: 2418951,
      Name: 'Vantage Fuels'
    },
    {
      BrandId: 2418994,
      Name: 'Pacific Petroleum'
    },
    {
      BrandId: 2418995,
      Name: 'Vibe'
    },
    {
      BrandId: 2419007,
      Name: 'Lowes'
    },
    {
      BrandId: 2419008,
      Name: 'Westside'
    },
    {
      BrandId: 2419036,
      Name: 'Tesla'
    },
    {
      BrandId: 2419037,
      Name: 'Enhance'
    },
    {
      BrandId: 2459022,
      Name: 'FuelXpress'
    },
    {
      BrandId: 3421028,
      Name: 'X Convenience'
    },
    {
      BrandId: 3421066,
      Name: 'Ampol'
    },
    {
      BrandId: 3421073,
      Name: 'Euro Garages'
    },
    {
      BrandId: 3421074,
      Name: 'Perrys'
    }
  ] as const;

  type BrandId = typeof brands[number]['BrandId'];

  const brandLogos: { [brand in BrandId]: string | undefined } = {
    2: 'http://logok.org/wp-content/uploads/2020/09/Caltex-logo--1536x1229.png',
    5: 'https://upload.wikimedia.org/wikipedia/en/d/d2/BP_Helios_logo.svg',
    // 7: 'https://www.budget.com/content/dam/budget/images/logos/logo-budget.svg',
    12: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Eo_circle_orange_letter-i.svg/100px-Eo_circle_orange_letter-i.svg.png',
    16: 'https://i.pinimg.com/originals/74/93/52/74935256bc6467ce1f613e8ae8a7b444.jpg',
    20: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e8/Shell_logo.svg/150px-Shell_logo.svg.png',
    23: 'https://www.kdpr.com.au/wp-content/uploads/united-petroleum-logo.jpg',
    // 27: 'https://www.unbranded.com/content/dam/unbranded/images/logo.svg',
    // 39: 'https://www.matilda.com.au/content/dam/matilda/images/logo.svg',
    // 51: 'https://www.apco.com.au/content/dam/apco/images/logo.svg',
    57: 'https://metropetroleum.b-cdn.net/wp-content/uploads/2020/07/Metro-Logo-Blue.png',
    // 65: 'https://www.petrogas.com.au/content/dam/petrogas/images/logo.svg',
    // 72: 'https://www.gull.com.au/content/dam/gull/images/logo.svg',
    86: 'https://www.libertyoil.com.au/images/logo.png',
    // 87: 'https://www.am-pm.com.au/content/dam/am-pm/images/logo.svg',
    // 105: 'https://www.betterchoice.com.au/content/dam/betterchoice/images/logo.svg',
    // 108: 'https://www.unigas.com.au/content/dam/unigas/images/logo.svg',
    110: 'https://cdn.australia247.info/assets/uploads/a20ae9e979d1dddc5f1e84824ad66097_-queensland-moreton-bay-region-kallangur-freedom-fuels-kallangurhtml.jpg',
    111: 'https://cdn.australia247.info/assets/uploads/2832998c9c07f9d51324c62dcde0fe87_-new-south-wales-the-hills-shire-council-northmead-coles-expresshtml.jpg',
    112: 'http://www.parkridgetowncentre.com.au/wp-content/uploads/2018/04/caltex-photo.jpg',
    113: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/7-eleven_logo.svg/100px-7-eleven_logo.svg.png',
    // 114: 'https://www.astron.com.au/content/dam/astron/images/logo.svg',
    // 115: 'https://www.primepetroleum.com.au/content/dam/primepetroleum/images/logo.svg',
    // 116: 'https://www.cqp.com.au/content/dam/cqp/images/logo.svg',
    // 167: 'https://www.speedway.com.au/content/dam/speedway/images/logo.svg',
    // 169: 'https://www.onthe-run.com.au/content/dam/onthe-run/images/logo.svg',
    // 2301: 'https://www.choice.com.au/content/dam/choice/images/logo.svg',
    // 4896: 'https://www.mogas.com.au/content/dam/mogas/images/logo.svg',
    5094: 'https://fuelprice.io/wp-content/uploads/2018/08/puma-favicon-150x150.jpg',
    // 2031003: 'https://www.igagas.com.au/content/dam/igagas/images/logo.svg',
    // 2031031: 'https://www.costco.com/content/dam/costco/images/logo.svg',
    2418945:
      'https://upload.wikimedia.org/wikipedia/en/d/d2/BP_Helios_logo.svg',
    // 2418946:
    //   'https://www.riordanfuel.com.au/content/dam/riordanfuel/images/logo.svg',
    // 2418947:
    //   'https://www.riordanfuels.com.au/content/dam/riordanfuels/images/logo.svg',
    // 2418951:
    //   'https://www.vantagefuels.com.au/content/dam/vantagefuels/images/logo.svg',
    2418994:
      'https://www.pacificpetroleum.com.au/wp-content/uploads/2020/06/profile-picture-640x640-1-300x300.jpg',
    // 2418995: 'https://www.vibe.com.au/content/dam/vibe/images/logo.svg',
    // 2419007: 'https://www.lowes.com/content/dam/lowes/images/logo.svg',
    // 2419008: 'https://www.westside.com.au/content/dam/westside/images/logo.svg',
    // 2419036: 'https://www.tesla.com/content/dam/tesla/images/logo.svg',
    // 2419037: 'https://www.enhance.com.au/content/dam/enhance/images/logo.svg',
    // 2459022:
    //   'https://www.fuelxpress.com.au/content/dam/fuelxpress/images/logo.svg',
    // 3421028:
    //   'https://www.xconvenience.com.au/content/dam/xconvenience/images/logo.svg',
    3421066:
      'https://upload.wikimedia.org/wikipedia/en/thumb/4/4e/Ampol_Logo_May_2020.svg/100px-Ampol_Logo_May_2020.svg.png',
    // 3421073:
    //   'https://www.eurogarages.com.au/content/dam/eurogarages/images/logo.svg',
    // 3421074: 'https://www.perrys.com.au/content/dam/perrys/images/logo.svg'
    2418951: undefined,
    2418995: undefined,
    2419007: undefined,
    2419008: undefined,
    2419036: undefined,
    2419037: undefined,
    2459022: undefined,
    3421028: undefined,
    3421073: undefined,
    3421074: undefined,
    7: undefined,
    27: undefined,
    39: undefined,
    51: undefined,
    65: undefined,
    72: undefined,
    87: undefined,
    105: undefined,
    108: undefined,
    114: undefined,
    115: undefined,
    116: undefined,
    167: undefined,
    169: undefined,
    2301: undefined,
    4896: undefined,
    2031003: undefined,
    2031031: undefined,
    2418946: undefined,
    2418947: undefined
  };

  const getBrandLogo = (brandId: BrandId) => {
    return (
      brandLogos[brandId] ||
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Icon-round-Question_mark.svg/200px-Icon-round-Question_mark.svg.png'
    );
  };

  //   const regions = (await instance.get(regionEndpoint)).data;
  //   console.log(regions);
  // get fuel types
  // const fuelTypes = await instance.get(
  //   `Subscriber/GetCountryFuelTypes?countryId=${countryId}`
  // );
  // const brands = (
  //   await instance.get(`Subscriber/GetCountryBrands?countryId=${countryId}`)
  // ).data;
  // console.log(fuelTypes.data);
  // unleaded is 2

  // get sites
  const sites = (
    await instance.get(
      `Subscriber/GetFullSiteDetails?countryId=${countryId}&geoRegionLevel=${geoRegionLevel}&geoRegionId=${geoRegionId}`
    )
  ).data;
  // console.log(sites.S);

  // find nearby sites

  //   let currentLocation = {
  //     lat: -27.54749,
  //     lng: 152.93571
  //   };
  let currentLocation = {
    lat: Number.parseFloat(Array.isArray(lat) ? lat[0] : lat),
    lng: Number.parseFloat(Array.isArray(lng) ? lng[0] : lng)
  };
  console.log(currentLocation);
  //   currentLocation = { lat: -26.795640, lng: 153.108276 };

  const geoData = sites.S.map((site: any) => {
    return [site.Lat, site.Lng, site.S, site.N, site.A, site.P];
  });
  // console.log(geoData);
  const siteDetails = sites.S.map((site: any) => {
    return {
      lat: site.Lat,
      lng: site.Lng,
      id: site.S,
      name: site.N,
      address: site.A,
      postcode: site.P,
      brandId: site.B
    };
  });
  console.log(sites);

  const dataSet = (Geo as any).createCompactSet(geoData);
  const geo = new (Geo as any)(dataSet, {
    setOptions: { id: 'name', lat: 'lat', lon: 'lng' },
    sorted: true
  });

  const distanceRadiusKms = 30;

  const nearbySites = geo
    .nearBy(currentLocation.lat, currentLocation.lng, distanceRadiusKms * 1000)
    .map((site: any) => site.i);
  // console.log(nearbySites);

  // get prices
  const siteprices = (await instance.get(priceEndpoint)).data.SitePrices;
  // console.log(resp);

  const unleadedPrices = siteprices.filter((site: any) => site.FuelId === 2);
  // console.log(unleadedPrices);

  const nearbyPrices: FuelEntry[] = unleadedPrices
    .filter((price: any) => nearbySites.includes(price.SiteId))
    .map((site: any) => {
      const { id, name, address, postcode, lat, lng, brandId } =
        siteDetails.find((deet: any) => deet.id === site.SiteId);

      const distance = turfDistance(
        [currentLocation.lat, currentLocation.lng],
        [lat, lng],
        {
          units: 'kilometers'
        }
      );

      return {
        id: site.SiteId,
        name,
        address,
        postcode,
        distance: distance,
        distanceString: distance.toFixed(2) + ' km',
        price: site.Price / 10,
        brandId: brandId,
        brandLogo: getBrandLogo(brandId),
        lastUpdated: format(
          parseISO(site.TransactionDateUtc + '+00'),
          'yyyy-MM-dd HH:mm:ss',
          { locale: enAU }
        ),
        lat,
        lng
      };
    })

    //     .filter((site: any) => site.name.includes('7-Eleven'))
    .sort((a: any, b: any) => (a.distance < b.distance ? -1 : 1));
  // .filter(site => site.price < 1500);*/

  // res.status(200).json({ brands });
  res.status(200).json(nearbyPrices);
}
