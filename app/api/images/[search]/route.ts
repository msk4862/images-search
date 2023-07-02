import { NextResponse } from 'next/server';

import ServicesList from '@/utils/servicesList';
import Image from '@/utils/models/Image';
import { shuffleArray } from '@/utils/util';
import {
  UnsplashService,
  PexelsService,
  PixabayService,
  PlaceholderService,
} from '@/utils/image_services';

type TServices =
  | typeof UnsplashService.SERVICE_NAME
  | typeof PexelsService.SERVICE_NAME
  | typeof PixabayService.SERVICE_NAME
  | typeof PlaceholderService.SERVICE_NAME;

export type GetImageResponse = ReturnType<typeof GET>;

export const GET = async (
  _: Request,
  { params }: { params: { search: string } }
) => {
  // fetching all enabled services
  const enabledServices = ServicesList.getEnabledServicesList();
  const per_service_images = 3;
  //  const per_service_images = Math.ceil(total_images / enabledServices.length);

  const promises: Array<Promise<Image[]>> = [];
  // calling all enabled service's apis
  for (const service of enabledServices) {
    promises.push(new service().request(params.search, per_service_images));
  }

  let images: Image[] = [];
  const successfulServices: TServices[] = [];
  const unsuccessfulServices: TServices[] = [];

  try {
    const responses = await Promise.allSettled<Image[]>(
      promises.map((p) => p.catch((e) => e))
    );

    console.log('route', responses);

    for (let i = 0; i < responses.length; i++) {
      const serviceResult = responses[i];
      const serviceName = ServicesList.getEnabledServicesList()[i].SERVICE_NAME;

      if (serviceResult.status === 'rejected') {
        console.log(`Service failed - ${serviceName}: `, serviceResult.reason);
        unsuccessfulServices.push(serviceName);
      }
      // some other error occured during API call
      else if (serviceResult.value instanceof Error) {
        console.log(`Service failed - ${serviceName}: `, serviceResult.value);
        unsuccessfulServices.push(serviceName);
      } else {
        images = images.concat(serviceResult.value);
        successfulServices.push(serviceName);
      }
    }

    if (successfulServices.length > 0) {
      // shuffle images
      shuffleArray(images);
      return NextResponse.json({
        status: true,
        successfulServices: successfulServices,
        unsuccessfulServices: unsuccessfulServices,
        result: images,
      });
    } else {
      console.log('All services failed!');
      return NextResponse.json({ status: false, error: 'All services failed' });
    }
  } catch (e) {
    console.log('Main services fetching function failed - ', e);
    return NextResponse.json({
      status: false,
      error:
        'Something went wrong while fetching data from external APIs: ' + e,
    });
  }
};
