import { SFFData } from './types';

// Simulating the original JSON for faithful export
const MOCK_ORIGINAL_JSON = {
  metadata: {
    title: "Optimization of Ethanol Production from Corn Stover",
    authors: ["Y. Zhang", "T. Smith"]
  },
  units: [
    {
      id: "SFR-101",
      volume: "500 L",
      temperature: "32°C"
    }
  ],
  streams: [
    {
      id: "S-04",
      flow_rate: "12.5 kg/h"
    }
  ]
};

// Simulating the output from the "Resolver Agent" (Slide 21/23)
export const MOCK_SFF_DATA: SFFData = {
  fileName: "BioProcess_Optimization_Study_v4.pdf",
  originalJson: MOCK_ORIGINAL_JSON,
  fields: [
    {
      id: "meta-1",
      section: "Metadata",
      key: "title",
      path: "metadata.title",
      label: "Paper Title",
      value: "Optimization of Ethanol Production from Corn Stover",
      confidence: "High",
      isResolved: true,
      alternatives: [
        {
          agentName: "Gemini 2.5 Pro",
          value: "Optimization of Ethanol Production from Corn Stover",
          source: { page: 1, snippet: "Title: Optimization of Ethanol Production from Corn Stover" }
        },
        {
          agentName: "Grok 4",
          value: "Optimization of Ethanol Production from Corn Stover",
          source: { page: 1, snippet: "Title: Optimization of Ethanol Production from Corn Stover" }
        }
      ]
    },
    {
      id: "meta-2",
      section: "Metadata",
      key: "authors",
      path: "metadata.authors",
      label: "Authors",
      value: ["Y. Zhang", "T. Smith"],
      confidence: "Medium",
      isResolved: false,
      alternatives: [
        {
          agentName: "Gemini 2.5 Pro",
          value: ["Y. Zhang", "T. Smith", "M. Doe"],
          source: { page: 1, snippet: "Authors: Y. Zhang, T. Smith, and M. Doe" }
        },
        {
          agentName: "ChatGPT",
          value: ["Y. Zhang", "T. Smith"],
          source: { page: 1, snippet: "By Y. Zhang and T. Smith" }
        }
      ]
    },
    {
      id: "unit-101-vol",
      section: "Unit: Seed Fermenter (SFR-101)",
      key: "volume",
      path: "units[0].volume",
      label: "Operating Volume",
      value: "500 L",
      confidence: "Low",
      isResolved: false,
      alternatives: [
        {
          agentName: "Gemini 2.5 Pro",
          value: "500 L",
          source: { 
            page: 1, 
            paragraph: "Materials and Methods",
            snippet: "The seed fermentation was carried out in a 500 L bioreactor..." 
          }
        },
        {
          agentName: "Grok 4",
          value: "600 L",
          source: { 
            page: 1, 
            paragraph: "Table 2",
            snippet: "Table 2 Specification: Total Volume: 600 L" 
          }
        },
        {
          agentName: "ChatGPT",
          value: "500 L",
          source: { 
            page: 1, 
            snippet: "...working volume maintained at 500 L." 
          }
        }
      ]
    },
    {
      id: "unit-101-temp",
      section: "Unit: Seed Fermenter (SFR-101)",
      key: "temperature",
      path: "units[0].temperature",
      label: "Temperature",
      value: "32°C",
      confidence: "High",
      isResolved: true,
      alternatives: [
        {
          agentName: "Consensus",
          value: "32°C",
          source: { page: 1, snippet: "Temperature was controlled at 32°C throughout the process." }
        }
      ]
    },
    {
      id: "stream-04-flow",
      section: "Stream: Feed Input (S-04)",
      key: "flow_rate",
      path: "streams[0].flow_rate",
      label: "Mass Flow Rate",
      value: "12.5 kg/h",
      confidence: "Low",
      isResolved: false,
      alternatives: [
        {
          agentName: "Gemini 2.5 Pro",
          value: "12.5 kg/h",
          source: { page: 1, snippet: "The feed rate was set to 12.5 kg/h." }
        },
        {
          agentName: "Qwen 3 Coder",
          value: "12.5 L/h",
          source: { page: 1, snippet: "Feed rate: 12.5 (assumed liquid basis)" }
        }
      ]
    }
  ]
};