// Google Maps style clustering utility
export interface ClusterPoint {
  lat: number;
  lng: number;
  id: string;
  data: any; // Original toilet data
}

export interface Cluster {
  lat: number;
  lng: number;
  count: number;
  points: ClusterPoint[];
  id: string;
}

export interface ClusteringOptions {
  gridSize: number; // Grid size in pixels for clustering
  maxZoom: number; // Maximum zoom level to cluster
  minimumClusterSize: number; // Minimum points to form a cluster
}

// Default clustering options - conservative like Google Maps
export const DEFAULT_CLUSTERING_OPTIONS: ClusteringOptions = {
  gridSize: 100,
  maxZoom: 10,
  minimumClusterSize: 3
};

// Convert lat/lng to pixel coordinates for clustering
function latLngToPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = 1 << zoom;
  const worldCoordinateX = (lng + 180) / 360 * 256;
  const worldCoordinateY = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * 256;
  
  return {
    x: Math.floor(worldCoordinateX * scale),
    y: Math.floor(worldCoordinateY * scale)
  };
}

// Convert pixel coordinates back to lat/lng
function pixelToLatLng(x: number, y: number, zoom: number): { lat: number; lng: number } {
  const scale = 1 << zoom;
  const worldCoordinateX = x / scale;
  const worldCoordinateY = y / scale;
  
  const lng = worldCoordinateX / 256 * 360 - 180;
  const n = Math.PI - 2 * Math.PI * worldCoordinateY / 256;
  const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  
  return { lat, lng };
}

// Function to calculate distance between two points in kilometers
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Main clustering function
export function clusterPoints(
  points: ClusterPoint[], 
  zoom: number, 
  options: ClusteringOptions = DEFAULT_CLUSTERING_OPTIONS
): (ClusterPoint | Cluster)[] {
  // Don't cluster at high zoom levels (street view)
  if (zoom > options.maxZoom) {
    return points;
  }

  // If no points, return empty array
  if (points.length === 0) {
    return [];
  }

  // At extreme zoom out (continent/world view), create one big cluster
  if (zoom <= 3 && points.length > 10) {
    const totalLat = points.reduce((sum, p) => sum + p.lat, 0);
    const totalLng = points.reduce((sum, p) => sum + p.lng, 0);
    
    const superCluster: Cluster = {
      lat: totalLat / points.length,
      lng: totalLng / points.length,
      count: points.length,
      points: points,
      id: `super-cluster-${zoom}`
    };
    
    return [superCluster];
  }

  // Convert all points to pixel coordinates
  const pixelPoints = points.map(point => ({
    ...point,
    pixel: latLngToPixel(point.lat, point.lng, zoom)
  }));

  const clusters: Cluster[] = [];
  const clustered = new Set<string>();

  // Grid-based clustering
  const gridClusters = new Map<string, (ClusterPoint & { pixel: { x: number; y: number } })[]>();

  pixelPoints.forEach(point => {
    // Calculate grid cell
    const gridX = Math.floor(point.pixel.x / options.gridSize);
    const gridY = Math.floor(point.pixel.y / options.gridSize);
    const gridKey = `${gridX},${gridY}`;

    if (!gridClusters.has(gridKey)) {
      gridClusters.set(gridKey, []);
    }

    gridClusters.get(gridKey)!.push(point);
  });

  // Create clusters from grid cells - with distance validation for very large clusters
  gridClusters.forEach((cellPoints, gridKey) => {
    if (cellPoints.length >= options.minimumClusterSize) {
      // For very large clusters (50+ toilets), check if they're reasonably close
      if (cellPoints.length >= 50) {
        // Calculate max distance within the cluster
        let maxDistance = 0;
        for (let i = 0; i < cellPoints.length; i++) {
          for (let j = i + 1; j < cellPoints.length; j++) {
            const dist = calculateDistance(
              cellPoints[i].lat, cellPoints[i].lng,
              cellPoints[j].lat, cellPoints[j].lng
            );
            maxDistance = Math.max(maxDistance, dist);
          }
        }
        
        // If the cluster spans more than 10km, split it into smaller subclusters
        if (maxDistance > 10) {
          // Create multiple smaller clusters by subdividing the grid cell
          const subGridSize = options.gridSize / 2;
          const subClusters = new Map<string, (ClusterPoint & { pixel: { x: number; y: number } })[]>();
          
          cellPoints.forEach(point => {
            const subGridX = Math.floor(point.pixel.x / subGridSize);
            const subGridY = Math.floor(point.pixel.y / subGridSize);
            const subKey = `${subGridX},${subGridY}`;
            
            if (!subClusters.has(subKey)) {
              subClusters.set(subKey, []);
            }
            subClusters.get(subKey)!.push(point);
          });
          
          // Create clusters from subcells
          subClusters.forEach((subPoints, subKey) => {
            if (subPoints.length >= options.minimumClusterSize) {
              const totalLat = subPoints.reduce((sum, p) => sum + p.lat, 0);
              const totalLng = subPoints.reduce((sum, p) => sum + p.lng, 0);
              
              const cluster: Cluster = {
                lat: totalLat / subPoints.length,
                lng: totalLng / subPoints.length,
                count: subPoints.length,
                points: subPoints,
                id: `cluster-${gridKey}-${subKey}-${zoom}`
              };

              clusters.push(cluster);
              subPoints.forEach(p => clustered.add(p.id));
            }
            // Single points from subclusters will be added as individuals below
          });
          
          return; // Skip the regular clustering for this cell
        }
      }
      
      // Regular clustering for reasonable-sized groups
      const totalLat = cellPoints.reduce((sum, p) => sum + p.lat, 0);
      const totalLng = cellPoints.reduce((sum, p) => sum + p.lng, 0);
      
      const cluster: Cluster = {
        lat: totalLat / cellPoints.length,
        lng: totalLng / cellPoints.length,
        count: cellPoints.length,
        points: cellPoints,
        id: `cluster-${gridKey}-${zoom}`
      };

      clusters.push(cluster);
      cellPoints.forEach(p => clustered.add(p.id));
    }
    // Single points and small groups that don't meet minimum will be added as individuals below
  });

  // Return clusters and unclustered points
  const result: (ClusterPoint | Cluster)[] = [...clusters];
  
  // Add individual points that weren't clustered
  points.forEach(point => {
    if (!clustered.has(point.id)) {
      result.push(point);
    }
  });

  // Clustering completed

  return result;
}

// Check if an item is a cluster
export function isCluster(item: ClusterPoint | Cluster): item is Cluster {
  return 'count' in item && 'points' in item;
}

// Get cluster styling based on count
export function getClusterStyle(count: number): {
  size: number;
  color: string;
  textColor: string;
  fontSize: string;
} {
  if (count < 10) {
    return {
      size: 40,
      color: '#4285f4', // Google blue
      textColor: 'white',
      fontSize: '12px'
    };
  } else if (count < 25) {
    return {
      size: 50,
      color: '#ea4335', // Google red
      textColor: 'white',
      fontSize: '14px'
    };
  } else if (count < 50) {
    return {
      size: 60,
      color: '#fbbc04', // Google yellow
      textColor: 'black',
      fontSize: '16px'
    };
  } else {
    return {
      size: 70,
      color: '#34a853', // Google green
      textColor: 'white',
      fontSize: '18px'
    };
  }
}

// Calculate the bounds that contain all points in a cluster
export function getClusterBounds(cluster: Cluster): {
  north: number;
  south: number;
  east: number;
  west: number;
} {
  let north = -90, south = 90, east = -180, west = 180;
  
  cluster.points.forEach(point => {
    north = Math.max(north, point.lat);
    south = Math.min(south, point.lat);
    east = Math.max(east, point.lng);
    west = Math.min(west, point.lng);
  });

  return { north, south, east, west };
}
