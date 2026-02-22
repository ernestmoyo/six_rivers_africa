# =============================================================================
# Six Rivers Africa — Landscape Health Intelligence Dashboard
# R Shiny Application
#
# Interactive web dashboard for visualising landscape health indicators,
# alert status, and trend analysis across both operational zones.
#
# Author: Ernest Moyo / 7Square Inc.
# =============================================================================

library(shiny)
library(shinydashboard)
library(leaflet)
library(plotly)
library(jsonlite)
library(DT)

# =============================================================================
# CONFIGURATION
# =============================================================================

CONFIG_PATH <- file.path("..", "..", "config")
DATA_PATH <- file.path("..", "..", "data")

zones_config <- fromJSON(file.path(CONFIG_PATH, "zones.json"))
indicators_config <- fromJSON(file.path(CONFIG_PATH, "indicators.json"))

# Zone centroid coordinates (indicative — PLACEHOLDER)
zone_centres <- data.frame(
  zone_id = c("zone_1", "zone_1_ihefu", "zone_2"),
  name = c("Usangu Game Reserve", "Ihefu Swamp Core", "Nyerere National Park"),
  lat = c(-8.65, -8.72, -9.00),
  lon = c(34.00, 33.95, 37.40),
  area_km2 = c(2500, 350, 30893),
  authority = c("TAWA", "TAWA", "TANAPA"),
  status = c("PLACEHOLDER", "PLACEHOLDER", "PLACEHOLDER"),
  stringsAsFactors = FALSE
)

# Severity colour palette
severity_colours <- c(
  "NORMAL" = "#4CAF50",
  "MODERATE" = "#FF9800",
  "HIGH" = "#F44336"
)

# =============================================================================
# UI
# =============================================================================

ui <- dashboardPage(
  skin = "green",

  dashboardHeader(
    title = span(
      "Six Rivers Africa",
      style = "font-weight: bold; font-size: 18px;"
    ),
    titleWidth = 280
  ),

  dashboardSidebar(
    width = 280,
    sidebarMenu(
      id = "tabs",
      menuItem("Overview Map", tabName = "map", icon = icon("globe-africa")),
      menuItem("Vegetation Health", tabName = "vegetation", icon = icon("leaf")),
      menuItem("Fire Monitoring", tabName = "fire", icon = icon("fire")),
      menuItem("Water Dynamics", tabName = "water", icon = icon("water")),
      menuItem("Climate Context", tabName = "climate", icon = icon("cloud-rain")),
      menuItem("Land Cover", tabName = "landcover", icon = icon("tree")),
      menuItem("Alert Dashboard", tabName = "alerts", icon = icon("exclamation-triangle")),
      menuItem("Monthly Report", tabName = "report", icon = icon("file-alt"))
    ),

    hr(),

    # Period selector
    selectInput("year", "Year", choices = 2018:2026, selected = 2026),
    selectInput("month", "Month",
                choices = setNames(1:12, month.name),
                selected = 1),

    # Zone selector
    checkboxGroupInput("zones", "Zones",
                       choices = c(
                         "Usangu GR" = "zone_1",
                         "Ihefu Core" = "zone_1_ihefu",
                         "Nyerere NP" = "zone_2"
                       ),
                       selected = c("zone_1", "zone_1_ihefu", "zone_2")),

    hr(),

    div(
      style = "padding: 10px; font-size: 11px; color: #999;",
      HTML("<strong>Boundary Status:</strong> PLACEHOLDER<br>"),
      HTML("Awaiting verified shapefiles from SRA<br><br>"),
      HTML("Ernest Moyo / 7Square Inc.<br>"),
      HTML("Research & Restoration Programme")
    )
  ),

  dashboardBody(
    tags$head(
      tags$style(HTML("
        .content-wrapper { background-color: #f7f7f7; }
        .small-box { border-radius: 8px; }
        .box { border-radius: 8px; }
        .spatial-disclaimer {
          background: #FFF3E0; border-left: 4px solid #FF9800;
          padding: 12px; margin-bottom: 15px; font-size: 13px;
        }
      "))
    ),

    tabItems(

      # ===== MAP TAB =====
      tabItem(
        tabName = "map",
        div(class = "spatial-disclaimer",
            HTML("<strong>Spatial Disclaimer:</strong> Zone boundaries are indicative
                  placeholders. Spatial attribution is approximate until authoritative
                  shapefiles are received from Six Rivers Africa.")),

        fluidRow(
          valueBoxOutput("total_area_box", width = 3),
          valueBoxOutput("alert_count_box", width = 3),
          valueBoxOutput("indicators_box", width = 3),
          valueBoxOutput("boundary_status_box", width = 3)
        ),

        fluidRow(
          box(
            title = "Operational Area — Southern Tanzania",
            width = 12,
            status = "success",
            solidHeader = TRUE,
            leafletOutput("overview_map", height = 550)
          )
        )
      ),

      # ===== VEGETATION TAB =====
      tabItem(
        tabName = "vegetation",
        fluidRow(
          box(
            title = "NDVI Trend — Monthly Time Series",
            width = 6, status = "success", solidHeader = TRUE,
            plotlyOutput("ndvi_plot", height = 350)
          ),
          box(
            title = "EVI Trend — Monthly Time Series",
            width = 6, status = "success", solidHeader = TRUE,
            plotlyOutput("evi_plot", height = 350)
          )
        ),
        fluidRow(
          box(
            title = "Vegetation Deviation from Baseline",
            width = 12, status = "warning", solidHeader = TRUE,
            plotlyOutput("deviation_plot", height = 300)
          )
        )
      ),

      # ===== FIRE TAB =====
      tabItem(
        tabName = "fire",
        fluidRow(
          valueBoxOutput("fire_count_z1", width = 4),
          valueBoxOutput("fire_count_z2", width = 4),
          valueBoxOutput("burn_area_total", width = 4)
        ),
        fluidRow(
          box(
            title = "Fire Detections Map",
            width = 8, status = "danger", solidHeader = TRUE,
            leafletOutput("fire_map", height = 450)
          ),
          box(
            title = "Burn Scar Time Series",
            width = 4, status = "danger", solidHeader = TRUE,
            plotlyOutput("burn_timeseries", height = 450)
          )
        )
      ),

      # ===== WATER TAB =====
      tabItem(
        tabName = "water",
        fluidRow(
          box(
            title = "Ihefu Swamp — Surface Water Extent",
            width = 6, status = "primary", solidHeader = TRUE,
            plotlyOutput("ihefu_water_plot", height = 350)
          ),
          box(
            title = "NDWI — Wetland Health Index",
            width = 6, status = "primary", solidHeader = TRUE,
            plotlyOutput("ndwi_plot", height = 350)
          )
        ),
        fluidRow(
          box(
            title = "Great Ruaha River Connectivity",
            width = 12, status = "info", solidHeader = TRUE,
            plotlyOutput("ruaha_connectivity", height = 250)
          )
        )
      ),

      # ===== CLIMATE TAB =====
      tabItem(
        tabName = "climate",
        fluidRow(
          box(
            title = "CHIRPS Rainfall — Monthly Totals",
            width = 6, status = "primary", solidHeader = TRUE,
            plotlyOutput("rainfall_plot", height = 350)
          ),
          box(
            title = "Land Surface Temperature",
            width = 6, status = "warning", solidHeader = TRUE,
            plotlyOutput("lst_plot", height = 350)
          )
        ),
        fluidRow(
          box(
            title = "Rainfall Anomaly vs 30-Year Mean",
            width = 12, status = "danger", solidHeader = TRUE,
            plotlyOutput("rainfall_anomaly_plot", height = 250)
          )
        )
      ),

      # ===== LAND COVER TAB =====
      tabItem(
        tabName = "landcover",
        fluidRow(
          box(
            title = "Land Cover Composition",
            width = 6, status = "success", solidHeader = TRUE,
            plotlyOutput("lc_composition", height = 400)
          ),
          box(
            title = "Forest Loss — Annual Trend (2001–2023)",
            width = 6, status = "danger", solidHeader = TRUE,
            plotlyOutput("forest_loss_trend", height = 400)
          )
        )
      ),

      # ===== ALERTS TAB =====
      tabItem(
        tabName = "alerts",
        fluidRow(
          box(
            title = "Active Alerts — Current Month",
            width = 12, status = "danger", solidHeader = TRUE,
            DTOutput("alert_table")
          )
        ),
        fluidRow(
          box(
            title = "Alert History — 12 Month View",
            width = 12, status = "warning", solidHeader = TRUE,
            plotlyOutput("alert_history", height = 300)
          )
        )
      ),

      # ===== REPORT TAB =====
      tabItem(
        tabName = "report",
        fluidRow(
          box(
            title = "Monthly Landscape Health Report",
            width = 12, status = "success", solidHeader = TRUE,
            verbatimTextOutput("report_text"),
            hr(),
            downloadButton("download_report", "Download Report (TXT)"),
            downloadButton("download_donor", "Download Donor Brief")
          )
        )
      )
    )
  )
)

# =============================================================================
# SERVER
# =============================================================================

server <- function(input, output, session) {

  # --- VALUE BOXES ---

  output$total_area_box <- renderValueBox({
    valueBox(
      "~33,393 km²", "Total Monitoring Area",
      icon = icon("map"), color = "green"
    )
  })

  output$alert_count_box <- renderValueBox({
    valueBox(
      "0", "Active Alerts",
      icon = icon("exclamation-triangle"), color = "yellow"
    )
  })

  output$indicators_box <- renderValueBox({
    valueBox(
      "8", "Environmental Indicators",
      icon = icon("chart-bar"), color = "blue"
    )
  })

  output$boundary_status_box <- renderValueBox({
    valueBox(
      "PLACEHOLDER", "Boundary Status",
      icon = icon("map-marker-alt"), color = "orange"
    )
  })

  output$fire_count_z1 <- renderValueBox({
    valueBox("--", "Zone 1 Fire Detections", icon = icon("fire"), color = "red")
  })

  output$fire_count_z2 <- renderValueBox({
    valueBox("--", "Zone 2 Fire Detections", icon = icon("fire"), color = "red")
  })

  output$burn_area_total <- renderValueBox({
    valueBox("-- km²", "Total Burn Scar Area", icon = icon("burn"), color = "orange")
  })

  # --- OVERVIEW MAP ---

  output$overview_map <- renderLeaflet({
    leaflet() %>%
      addProviderTiles(providers$Esri.WorldImagery, group = "Satellite") %>%
      addProviderTiles(providers$OpenStreetMap, group = "Street Map") %>%
      addProviderTiles(providers$Esri.WorldTopoMap, group = "Topographic") %>%

      # Zone 1: Usangu GR (indicative rectangle)
      addRectangles(
        lng1 = 33.20, lat1 = -9.15, lng2 = 34.70, lat2 = -8.10,
        color = "#2d8659", weight = 2, fillOpacity = 0.15,
        group = "Zone 1",
        popup = paste0(
          "<strong>Zone 1: Usangu Game Reserve</strong><br>",
          "Authority: TAWA<br>",
          "Area: ~2,500 km² (indicative)<br>",
          "Status: PLACEHOLDER boundary<br>",
          "Key species: Elephant, Buffalo, Wild Dog, Lion"
        )
      ) %>%

      # Ihefu Core (indicative rectangle)
      addRectangles(
        lng1 = 33.60, lat1 = -8.95, lng2 = 34.30, lat2 = -8.50,
        color = "#2196F3", weight = 2, fillOpacity = 0.25,
        group = "Ihefu Core",
        popup = paste0(
          "<strong>Ihefu Swamp Core</strong><br>",
          "Area: ~350 km² (indicative)<br>",
          "Sensitivity: HIGHEST<br>",
          "MODERATE alerts escalate to HIGH"
        )
      ) %>%

      # Zone 2: Nyerere NP (indicative rectangle)
      addRectangles(
        lng1 = 35.50, lat1 = -10.80, lng2 = 39.50, lat2 = -7.30,
        color = "#C0392B", weight = 2, fillOpacity = 0.10,
        group = "Zone 2",
        popup = paste0(
          "<strong>Zone 2: Nyerere National Park (Selous)</strong><br>",
          "Authority: TANAPA<br>",
          "Area: ~30,893 km² (indicative)<br>",
          "UNESCO World Heritage Site (1982)<br>",
          "Status: PLACEHOLDER boundary"
        )
      ) %>%

      # Ikoga Airstrip (SRA base)
      addMarkers(
        lng = 34.30, lat = -8.85,
        popup = "<strong>Ikoga Airstrip</strong><br>Six Rivers Africa Base (approx.)",
        icon = makeIcon(iconUrl = NULL, iconWidth = 25, iconHeight = 41)
      ) %>%

      # Map controls
      addLayersControl(
        baseGroups = c("Satellite", "Street Map", "Topographic"),
        overlayGroups = c("Zone 1", "Ihefu Core", "Zone 2"),
        options = layersControlOptions(collapsed = FALSE)
      ) %>%

      setView(lng = 36.0, lat = -9.0, zoom = 6) %>%

      addScaleBar(position = "bottomleft") %>%

      addControl(
        html = paste0(
          '<div style="background: white; padding: 8px; border-radius: 4px;',
          'font-size: 11px; border: 1px solid #ccc;">',
          '<strong>Six Rivers Africa</strong><br>',
          'Landscape Health Intelligence<br>',
          '<span style="color: #FF9800;">Boundaries: PLACEHOLDER</span>',
          '</div>'
        ),
        position = "bottomright"
      )
  })

  # --- FIRE MAP ---

  output$fire_map <- renderLeaflet({
    leaflet() %>%
      addProviderTiles(providers$Esri.WorldImagery) %>%
      addRectangles(
        lng1 = 33.20, lat1 = -9.15, lng2 = 34.70, lat2 = -8.10,
        color = "#2d8659", weight = 2, fillOpacity = 0.05
      ) %>%
      addRectangles(
        lng1 = 35.50, lat1 = -10.80, lng2 = 39.50, lat2 = -7.30,
        color = "#C0392B", weight = 2, fillOpacity = 0.05
      ) %>%
      setView(lng = 36.0, lat = -9.0, zoom = 6) %>%
      addControl(
        html = '<div style="background:white;padding:5px;font-size:11px;">Fire data loaded from GEE exports</div>',
        position = "topright"
      )
  })

  # --- PLACEHOLDER PLOTS ---
  # These will render actual data once GEE exports are available

  placeholder_plot <- function(title) {
    plot_ly() %>%
      layout(
        title = list(text = title, font = list(size = 14)),
        annotations = list(
          text = "Awaiting GEE data export",
          xref = "paper", yref = "paper",
          x = 0.5, y = 0.5, showarrow = FALSE,
          font = list(size = 16, color = "#999")
        ),
        xaxis = list(visible = FALSE),
        yaxis = list(visible = FALSE)
      )
  }

  output$ndvi_plot <- renderPlotly({ placeholder_plot("NDVI Time Series") })
  output$evi_plot <- renderPlotly({ placeholder_plot("EVI Time Series") })
  output$deviation_plot <- renderPlotly({ placeholder_plot("Vegetation Deviation") })
  output$ihefu_water_plot <- renderPlotly({ placeholder_plot("Ihefu Water Extent") })
  output$ndwi_plot <- renderPlotly({ placeholder_plot("NDWI") })
  output$ruaha_connectivity <- renderPlotly({ placeholder_plot("Ruaha Connectivity") })
  output$rainfall_plot <- renderPlotly({ placeholder_plot("Rainfall") })
  output$lst_plot <- renderPlotly({ placeholder_plot("LST") })
  output$rainfall_anomaly_plot <- renderPlotly({ placeholder_plot("Rainfall Anomaly") })
  output$lc_composition <- renderPlotly({ placeholder_plot("Land Cover") })
  output$forest_loss_trend <- renderPlotly({ placeholder_plot("Forest Loss Trend") })
  output$burn_timeseries <- renderPlotly({ placeholder_plot("Burn Scar History") })
  output$alert_history <- renderPlotly({ placeholder_plot("Alert History") })

  # --- ALERT TABLE ---

  output$alert_table <- renderDT({
    datatable(
      data.frame(
        Zone = character(),
        Indicator = character(),
        Severity = character(),
        Detail = character(),
        stringsAsFactors = FALSE
      ),
      options = list(
        pageLength = 20,
        language = list(emptyTable = "No active alerts — GEE data pending")
      ),
      rownames = FALSE
    )
  })

  # --- REPORT TEXT ---

  output$report_text <- renderText({
    paste(
      "LANDSCAPE HEALTH INTELLIGENCE REPORT",
      "=====================================",
      "",
      "Reporting period: Pending GEE data export",
      "Zones: Usangu GR / Ihefu Wetland | Nyerere NP (Selous)",
      "",
      "Report will be auto-generated once monthly GEE exports are processed.",
      "Run: python python/pipeline/gee_export_processor.py --year YYYY --month MM",
      "Then: python python/analysis/report_generator.py --year YYYY --month MM",
      "",
      "Boundary Status: PLACEHOLDER",
      "Prepared by: Ernest Moyo / 7Square Inc.",
      sep = "\n"
    )
  })
}

# =============================================================================
# LAUNCH
# =============================================================================

shinyApp(ui = ui, server = server)
