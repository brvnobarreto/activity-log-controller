import { useState, useRef, useEffect } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

/**
 * ============================================
 * TELA: Campus
 * ============================================
 *
 * Exibe um mapa interativo (Leaflet + OpenStreetMap) centralizado na UNIFOR.
 * Substitui a imagem estática anterior e permite dar zoom/pan no campus.
 * Também oferece um campo de busca para localizar blocos/áreas com base
 * em coordenadas obtidas do Google Maps.
 *
 * - `MapContainer` configura a área do mapa.
 * - `TileLayer` aponta para o provedor (OpenStreetMap).
 * - `Marker` destaca a localização principal com um popup.
 */

const UNIFOR_COORDS: L.LatLngExpression = [-3.771928, -38.480394];

type CampusLocation = {
  id: string;
  nome: string;
  descricao?: string;
  coords: L.LatLngExpression;
};

const CAMPUS_LOCATIONS: CampusLocation[] = [
  {
    id: "bloco-b",
    nome: "Bloco B",
    descricao: "Salas de aula e laboratórios multidisciplinares.",
    coords: [-3.770693754558841, -38.4813745690203],
  },
  {
    id: "bloco-d",
    nome: "Bloco D",
    descricao: "Departamentos acadêmicos e salas de aula.",
    coords: [-3.7704686277235675, -38.480480796889594],
  },
  {
    id: "prefeitura",
    nome: "Prefeitura do Campus",
    descricao: "Infraestrutura e serviços gerais da universidade.",
    coords: [-3.770698905674946, -38.479238764219076],
  },
  {
    id: "bloco-j",
    nome: "Bloco J",
    descricao: "Salas de aula e apoio pedagógico.",
    coords: [-3.770128965019529, -38.479624372296776],
  },
  {
    id: "bloco-i",
    nome: "Bloco I",
    descricao: "Estrutura acadêmica com foco em saúde.",
    coords: [-3.769868610943583, -38.47987214077378],
  },
  {
    id: "bloco-c",
    nome: "Bloco C",
    descricao: "Salas de aula próximas à praça central.",
    coords: [-3.7697255801662064, -38.48122868674067],
  },
  {
    id: "reitoria-espaco-cultural",
    nome: "Reitoria e Espaço Cultural da UNIFOR",
    descricao: "Galerias e exposições culturais da universidade.",
    coords: [-3.7689287082380076, -38.48154894641901],
  },
  {
    id: "biblioteca",
    nome: "Biblioteca Central",
    descricao: "Acervo principal e salas de estudo.",
    coords: [-3.7688098251445443, -38.48069722018367],
  },
  {
    id: "centro-convivencia",
    nome: "Centro de Convivência",
    descricao: "Praça de alimentação e serviços ao estudante.",
    coords: [-3.7692080524985143, -38.479653729761814],
  },
  {
    id: "bloco-m",
    nome: "Bloco M",
    descricao: "Centro tecnológico e laboratórios de informática.",
    coords: [-3.768879521146858, -38.47867477453259],
  },
  {
    id: "bloco-k",
    nome: "Bloco K",
    descricao: "Estrutura acadêmica próxima ao Centro Cultural.",
    coords: [-3.769585470227412, -38.47881973057682],
  },
];

function formatLatLng(coords: L.LatLngExpression) {
  if (Array.isArray(coords)) {
    const [lat, lng] = coords;
    return {
      lat: lat.toFixed(5),
      lng: lng.toFixed(5),
    };
  }
  if (coords instanceof L.LatLng) {
    return {
      lat: coords.lat.toFixed(5),
      lng: coords.lng.toFixed(5),
    };
  }
  return { lat: "—", lng: "—" };
}

// Corrige os caminhos dos ícones padrão do Leaflet quando usado com bundlers como Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function Campus() {
  usePageTitle("Campus");

  const mapRef = useRef<L.Map | null>(null);
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  const [searchTerm, setSearchTerm] = useState("");
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return;

    const foundLocation = CAMPUS_LOCATIONS.find((location) =>
      location.nome.toLowerCase().includes(normalized)
    );

    if (foundLocation) {
      setActiveLocationId(foundLocation.id);
      mapRef.current?.flyTo(foundLocation.coords, 18, { duration: 1.25 });
    }
  };

  useEffect(() => {
    if (activeLocationId && markerRefs.current[activeLocationId]) {
      markerRefs.current[activeLocationId]?.openPopup();
    }
  }, [activeLocationId]);

  return (
    <div className="space-y-4 p-4">
      <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar blocos ou locais do campus..."
          aria-label="Buscar blocos ou locais do campus"
        />
        <Button type="submit" className="sm:w-auto">
          <Search className="mr-2 h-4 w-4" />
          Buscar
        </Button>
      </form>
      <MapContainer
        center={UNIFOR_COORDS}
        zoom={16}
        className="h-[calc(100vh-11rem)] w-full rounded-md"
        scrollWheelZoom
        ref={(mapInstance) => {
          mapRef.current = mapInstance;
        }}
      >
        <TileLayer
          attribution='Tiles &copy; Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        {CAMPUS_LOCATIONS.map((location) => (
          <Marker
            key={location.id}
            position={location.coords}
            ref={(instance) => {
              markerRefs.current[location.id] = instance;
            }}
            eventHandlers={{
              click: () => setActiveLocationId(location.id),
            }}
          >
            <Popup>
              <div className="space-y-1">
                <h3 className="font-semibold">{location.nome}</h3>
                {location.descricao ? (
                  <p className="text-sm text-muted-foreground">{location.descricao}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const { lat, lng } = formatLatLng(location.coords);
                    return <>Lat: {lat} | Lng: {lng}</>;
                  })()}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
